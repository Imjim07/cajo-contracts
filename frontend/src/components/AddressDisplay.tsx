import { explorerAddressUrl } from '../config';
import { shortenAddress } from '../lib/format';
import { CopyButton } from './CopyButton';

interface AddressDisplayProps {
  address: string;
  label: string;
}

/** Shortened address linking to BscScan, with a copy button for the full value. */
export function AddressDisplay({ address, label }: AddressDisplayProps) {
  return (
    <span className="address">
      <a
        className="address-link mono"
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
        aria-label={`${label} ${address} on BscScan (opens in a new tab)`}
      >
        {shortenAddress(address)}
      </a>
      <CopyButton value={address} label={label} />
    </span>
  );
}
