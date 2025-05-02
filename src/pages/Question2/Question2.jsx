import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

export default function Question2() {
  const [rows, setRows] = useState([]);
  const [org, setOrg] = useState("GAStech");   // currently selected organisation
  const chartRef = useRef(null);

  /* load CSV once */
  useEffect(() => {
    d3.csv("/bias_report.csv").then((data) => {
      data.forEach((d) => {
        d.vader_mean = +d.vader_mean;
        d.n_articles = +d.n_articles;
      });
      setRows(data);
    });
  }, []);

  /* redraw chart whenever org or data changes */
  useEffect(() => {
    if (!rows.length) return;

    const filtered = rows.filter((d) => d.organization === org);
    const w = 550,
      h = 300,
      pad = 45;

    const svg = d3
      .select(chartRef.current)
      .attr("viewBox", `0 0 ${w} ${h}`)
      .style("max-width", "100%");
    svg.selectAll("*").remove();

    const x = d3
      .scaleBand()
      .domain(filtered.map((d) => d.outlet))
      .range([pad, w - pad])
      .padding(0.2);
    const y = d3.scaleLinear().domain([-1, 1]).range([h - pad, pad]);

    svg
      .append("g")
      .attr("transform", `translate(0,${h - pad})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    svg
      .append("g")
      .attr("transform", `translate(${pad},0)`)
      .call(d3.axisLeft(y));

    svg
      .append("g")
      .selectAll("rect")
      .data(filtered)
      .join("rect")
      .attr("x", (d) => x(d.outlet))
      .attr("y", (d) => (d.vader_mean >= 0 ? y(d.vader_mean) : y(0)))
      .attr("height", (d) => Math.abs(y(d.vader_mean) - y(0)))
      .attr("width", x.bandwidth())
      .attr("fill", (d) => (d.vader_mean >= 0 ? "#4caf50" : "#e24"));

    svg
      .append("text")
      .attr("x", w / 2)
      .attr("y", pad / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", 14)
      .text(`Average VADER sentiment for ${org}`);
  }, [rows, org]);

  const filteredTable = rows.filter((d) => d.organization === org);

  return (
    <div className="w-screen px-4 py-4">
      <h2 className="text-xl font-semibold mb-4 text-center">
        Question 2 – Bias Detection by Outlet
      </h2>

      {/* selector */}
      <div className="flex justify-center mb-4">
        <label className="mr-2 font-medium">Organisation:</label>
        <select
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option>GAStech</option>
          <option>APA</option>
          <option>POK</option>
        </select>
      </div>

      {/* bar‑chart */}
      <svg ref={chartRef}></svg>

      {/* table */}
      {filteredTable.length > 0 && (
        <div className="overflow-x-auto mt-6">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(filteredTable[0]).map((k) => (
                  <th key={k} className="px-2 py-1 border">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTable.map((r, i) => (
                <tr key={i}>
                  {Object.values(r).map((v, j) => (
                    <td key={j} className="px-2 py-1 border">
                      {typeof v === "number" ? v.toFixed(3) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
