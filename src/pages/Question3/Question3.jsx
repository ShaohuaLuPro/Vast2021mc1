import ForceGraph from "../../components/ForceGraph.jsx";

export default function Question3() {
  const handleReset = () => window.location.reload();   // hard refresh

  return (
    <div className="w-screen px-0">
      <div className="flex items-center justify-between px-6">
        <h2 className="text-xl font-semibold my-4 text-center grow">
          Official&nbsp;&amp;&nbsp;Unofficial Relationships
        </h2>

        {/* reset button */}
        <button
          onClick={handleReset}
          className="shrink-0 h-8 px-4 rounded bg-gray-200 hover:bg-gray-300
                     border border-gray-400 text-sm"
        >
          Reset
        </button>
      </div>

      <ForceGraph />
    </div>
  );
}
