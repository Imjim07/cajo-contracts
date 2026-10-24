import { ZeroAddress } from 'ethers';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ErrorState, Skeleton } from '../../components/Feedback';
import { CheckIcon, CloseIcon, ExternalIcon, WarningIcon } from '../../components/Icons';
import { WalletButton } from '../../components/WalletButton';
import { CHAIN, FAUCET_URL, explorerTxUrl } from '../../config';
import { useModal } from '../../hooks/useModal';
import { usePolledResource } from '../../hooks/usePolledResource';
import { fetchJoinContext } from '../../lib/cajo';
import { describeTxError, sendApprove, sendJoin, waitForSuccess } from '../../lib/cajoWrite';
import { formatTokenAmount } from '../../lib/format';
import type { GroupRecord, TokenInfo } from '../../types/cajo';
import { useWallet } from '../../useWallet';

interface JoinSlotDialogProps {
  group: GroupRecord;
  token: TokenInfo;
  position: number;
  onClose: () => void;
  onJoined: () => void;
}

type Step = 'approve' | 'join';
type Phase =
  | { kind: 'idle' }
  | { kind: 'signing'; step: Step }
  | { kind: 'pending'; step: Step; hash: string }
  | { kind: 'done'; hash: string };

function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a className="tx-link" href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer">
      {label} <ExternalIcon />
      <span className="sr-only"> (opens BscScan in a new tab)</span>
    </a>
  );
}

function Blocked({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="join-blocked" role="status">
      <WarningIcon size={18} />
      <div>
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export function JoinSlotDialog({ group, token, position, onClose, onJoined }: JoinSlotDialogProps) {
  const wallet = useWallet();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [approveHash, setApproveHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useModal(ref, true, onClose);

  const account = wallet.status === 'connected' && wallet.isCorrectChain ? wallet.account : null;
  const tokenReadable = token.decimals !== null;
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      account ? fetchJoinContext(group.id, position, account, token.address, signal) : Promise.reject(new Error('No wallet')),
    [group.id, position, account, token.address],
  );
  // Read once when the dialog opens and again after each step; never on a timer mid-transaction.
  const ctx = usePolledResource(account && tokenReadable ? `join:${group.id}:${position}:${account}` : null, fetcher, null);

  const amount = (value: bigint) => formatTokenAmount(value, token);
  const busy = phase.kind === 'signing' || phase.kind === 'pending';
  const roundsOwedAfter = group.memberTarget - position;

  const runApprove = async (deposit: bigint) => {
    setError(null);
    setPhase({ kind: 'signing', step: 'approve' });
    try {
      const tx = await sendApprove(token.address, deposit);
      setApproveHash(tx.hash);
      setPhase({ kind: 'pending', step: 'approve', hash: tx.hash });
      await waitForSuccess(tx);
      setPhase({ kind: 'idle' });
      ctx.refresh();
    } catch (err) {
      setError(describeTxError(err, 'You rejected the approval in your wallet. Nothing was sent.'));
      setPhase({ kind: 'idle' });
    }
  };

  const runJoin = async () => {
    setError(null);
    setPhase({ kind: 'signing', step: 'join' });
    try {
      const tx = await sendJoin(group.id, position);
      setPhase({ kind: 'pending', step: 'join', hash: tx.hash });
      await waitForSuccess(tx);
      setPhase({ kind: 'done', hash: tx.hash });
      onJoined();
    } catch (err) {
      setError(describeTxError(err, 'You rejected the join in your wallet. Nothing was sent.'));
      setPhase({ kind: 'idle' });
      ctx.refresh();
    }
  };

  let body: ReactNode;
  if (phase.kind === 'done') {
    body = (
      <div className="join-done" role="status">
        <span className="join-done-icon" aria-hidden="true">
          <CheckIcon size={22} />
        </span>
        <p>
          You hold slot {position} in group #{group.id.toString()}. You collect the pot in round {position}.
        </p>
        <TxLink hash={phase.hash} label="View join transaction" />
      </div>
    );
  } else if (wallet.status === 'unavailable' || wallet.status === 'disconnected' || wallet.status === 'connecting') {
    body = <Blocked action={<WalletButton />}>Connect a wallet to join this slot.</Blocked>;
  } else if (!wallet.isCorrectChain) {
    body = <Blocked action={<WalletButton />}>Your wallet is on another network. Switch to {CHAIN.shortName} to join.</Blocked>;
  } else if (!tokenReadable) {
    body = (
      <Blocked>
        This group's token address doesn't answer <code>decimals()</code>, so it may not be a token contract at all.
        Joining is disabled because the deposit transfer would fail.
      </Blocked>
    );
  } else if (ctx.isLoading) {
    body = (
      <div className="join-skeleton" aria-hidden="true">
        <Skeleton height="4.5em" />
        <Skeleton height="3em" />
      </div>
    );
  } else if (!ctx.data) {
    body = <ErrorState title="Couldn't check this slot" onRetry={ctx.refresh} />;
  } else {
    const c = ctx.data;
    const needsApproval = c.deposit > 0n && c.allowance < c.deposit;
    const approved = c.deposit === 0n || !needsApproval;

    let blocker: ReactNode = null;
    if (group.state !== 'Open') blocker = 'This group is no longer open for joining.';
    else if (c.chainNow > group.fillDeadline) blocker = "The fill deadline has passed, so this group can't be joined.";
    else if (c.slotHolder !== ZeroAddress) blocker = 'Someone has already taken this slot. Pick another open slot.';
    else if (c.memberState !== 'None') blocker = 'This wallet already holds a slot in this group. Each wallet can join once.';
    else if (c.balance < c.deposit) {
      blocker = (
        <>
          This slot locks {amount(c.deposit)} but your wallet holds {amount(c.balance)}.{' '}
          <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
            Get test tokens from the faucet
          </a>
          , or pick a later slot with a smaller deposit.
        </>
      );
    }

    body = (
      <>
        <dl className="facts-list join-facts">
          <div>
            <dt>Deposit to lock</dt>
            <dd>{amount(c.deposit)}</dd>
          </div>
          <div>
            <dt>You collect in</dt>
            <dd>
              Round {position} of {group.memberTarget}
            </dd>
          </div>
          <div>
            <dt>Contribution per round</dt>
            <dd>{amount(group.contributionAmount)}</dd>
          </div>
          <div>
            <dt>Your balance</dt>
            <dd>{amount(c.balance)}</dd>
          </div>
        </dl>

        <p className="muted small">
          Slot {position} still owes {roundsOwedAfter} round{roundsOwedAfter === 1 ? '' : 's'} after collecting, so it
          locks {roundsOwedAfter} contribution{roundsOwedAfter === 1 ? '' : 's'}. You get the deposit back when the cycle
          completes, unless you default.
        </p>

        {!token.allowlisted && (
          <p className="callout-inline callout-warn">
            This token isn't on the app's allowlist. Any ERC-20 can back a group, so check the token before you approve
            it.
          </p>
        )}

        {blocker ? (
          <Blocked>{blocker}</Blocked>
        ) : (
          <ol className="join-steps">
            {c.deposit > 0n && (
              <li className={approved ? 'is-done' : 'is-current'}>
                <span className="join-step-mark" aria-hidden="true">
                  {approved ? <CheckIcon size={14} /> : '1'}
                </span>
                <div>
                  <p className="join-step-title">Approve {amount(c.deposit)}</p>
                  <p className="muted small">
                    Lets the CÀjọ contract pull exactly the deposit and nothing more.
                    {approved && ' Done.'}
                  </p>
                  {approveHash && <TxLink hash={approveHash} label="View approval" />}
                </div>
              </li>
            )}
            <li className={approved ? 'is-current' : ''}>
              <span className="join-step-mark" aria-hidden="true">
                {c.deposit > 0n ? '2' : '1'}
              </span>
              <div>
                <p className="join-step-title">Join slot {position}</p>
                <p className="muted small">Calls joinGroup. The contract takes the deposit and records your slot.</p>
              </div>
            </li>
          </ol>
        )}

        {!blocker && (
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void (needsApproval ? runApprove(c.deposit) : runJoin())}
          >
            {busy && <span className="spinner" aria-hidden="true" />}
            {phase.kind === 'signing'
              ? 'Confirm in your wallet…'
              : phase.kind === 'pending'
                ? phase.step === 'approve'
                  ? 'Waiting for approval to confirm…'
                  : 'Waiting for join to confirm…'
                : needsApproval
                  ? `Approve ${amount(c.deposit)}`
                  : `Join slot ${position}`}
          </button>
        )}
        {phase.kind === 'pending' && phase.step === 'join' && <TxLink hash={phase.hash} label="View join transaction" />}
      </>
    );
  }

  return createPortal(
    <div className="dialog-backdrop" onClick={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="join-title">
        <div className="dialog-head">
          <h2 id="join-title" className="card-title">
            Join slot {position} · group #{group.id.toString()}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" data-autofocus>
            <CloseIcon />
          </button>
        </div>

        <div className="dialog-body">
          {body}
          <p className="sr-only" aria-live="polite">
            {phase.kind === 'signing' ? 'Waiting for your wallet.' : phase.kind === 'pending' ? 'Transaction sent. Waiting for confirmation.' : ''}
          </p>
          {error && (
            <p className="join-error" role="alert">
              {error}
            </p>
          )}
          <p className="join-footnote">Testnet only. Use test tokens; the contract is not independently audited.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
