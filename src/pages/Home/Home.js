export default function Home() {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4">VAST Challenge 2021 Visual Analytics</h1>
        <p className="mb-4">
          This project presents our analysis of the Mini-Challenge 1 (MC1) of the VAST 2021 Challenge. Our task is to investigate the landscape of news reporting and identify patterns, biases, and potential relationships within the news data provided.
        </p>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Question 1 – Characterization of News Sources</h2>
            <p>
              <strong>Hypothesis:</strong> Some news outlets (e.g., All News Today, Athena Speaks) serve as reporting sources, while others (e.g., International News, International Times) republish or paraphrase content from these sources.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Question 2 – Bias Detection in News Reporting</h2>
            <p>
              <strong>Hypothesis:</strong> Certain news outlets demonstrate political or ideological bias by using emotionally charged language or selective reporting when discussing GAStech, APA, or the POK.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Question 3 – Identification of Official and Unofficial Relationships</h2>
            <p>
              <strong>Hypothesis:</strong> There are unofficial ties between GAStech employees and members of the POK or APA, potentially signaling ideological alignment or covert collaboration.
            </p>
          </div>
        </div>
      </div>
    );
  }