import { useId, useState, type ReactNode } from 'react';
import { ChevronIcon } from '../../components/Icons';
import { MAX_FEE_BPS } from '../../config';
import { formatBps } from '../../lib/format';

interface FaqItem {
  question: string;
  answer: ReactNode;
}

function buildItems(feeBps: number | null): FaqItem[] {
  const currentFee = feeBps === null ? '' : ` The current fee is ${formatBps(feeBps)}.`;
  return [
    {
      question: 'What is an Ajo?',
      answer:
        'A rotating savings circle, common across West Africa and known as Esusu or a ROSCA elsewhere. A fixed group pays the same amount each round, and each round one member collects the whole pot until everyone has collected once. Traditionally a collector holds the money; CÀjọ replaces that role with a smart contract.',
    },
    {
      question: 'Is it safe to use?',
      answer:
        'Not with real money. CÀjọ is a testnet deployment. The contract is self-audited and covered by an automated test suite that includes attack scenarios, but it has not been independently audited, and bugs may exist. Use test tokens only.',
    },
    {
      question: 'What if I miss a payment?',
      answer:
        'After the round deadline plus the grace period, anyone can remove a member who has not paid. Their deposit is seized and their earlier contributions are forfeited. If they had not collected yet, their slot is removed and everyone behind them moves up one place.',
    },
    {
      question: 'Who controls the money?',
      answer:
        'The contract. There is no admin key and no way to pause, freeze or redirect funds. Tokens leave only through withdraw(), which each person calls for their own credited balance.',
    },
    {
      question: 'What does it cost?',
      answer: `A protocol fee set at deployment, capped in code at ${formatBps(MAX_FEE_BPS)} and immutable, taken from each pot when it pays out. Deposits and refunds carry no fee.${currentFee} You also pay network gas, which on testnet is free test BNB.`,
    },
    {
      question: 'Can I use real money?',
      answer:
        'No. CÀjọ is not deployed to mainnet. A professional audit and legal review would have to come first.',
    },
  ];
}

export function Faq({ feeBps }: { feeBps: number | null }) {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);
  const items = buildItems(feeBps);

  return (
    <section id="faq" className="section section-alt" aria-labelledby="faq-title">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">FAQ</p>
          <h2 id="faq-title" className="section-title">
            Questions, answered plainly
          </h2>
        </div>
        <div className="accordion reveal">
          {items.map((item, i) => {
            const isOpen = open === i;
            const buttonId = `${baseId}-q${i}`;
            const panelId = `${baseId}-a${i}`;
            return (
              <div key={item.question} className={`accordion-item${isOpen ? ' is-open' : ''}`}>
                <h3 className="accordion-heading">
                  <button
                    id={buttonId}
                    type="button"
                    className="accordion-trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.question}
                    <ChevronIcon />
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={buttonId} className="accordion-panel" hidden={!isOpen}>
                  <p>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
