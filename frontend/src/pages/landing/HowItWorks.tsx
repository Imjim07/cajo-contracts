const STEPS = [
  {
    title: 'Claim a payout slot by locking its deposit',
    body: 'Pick your position in the payout order. Earlier positions lock a bigger deposit; the last position locks nothing.',
  },
  {
    title: 'Contribute the fixed amount each round',
    body: 'Every active member pays the same contribution once per round, before the round deadline.',
  },
  {
    title: 'Collect the pot when your round comes, then withdraw it',
    body: 'The pot is credited to the member whose position matches the round. They withdraw it themselves.',
  },
  {
    title: 'Get your deposit back when the cycle completes',
    body: 'Once every round has paid out, members in good standing reclaim their full deposit.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="section section-alt" aria-labelledby="how-title">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="section-title">
            Four steps, one rotation
          </h2>
          <p className="section-lead">
            A fixed group, a fixed contribution, and a fixed order. The contract enforces each step.
          </p>
        </div>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step reveal">
              <span className="step-number" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="card-title">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
