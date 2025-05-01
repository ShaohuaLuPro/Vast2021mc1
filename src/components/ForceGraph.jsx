import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const palette = d3.schemeTableau10; // 10-colour cluster palette

export default function ForceGraph() {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const linkRef = useRef(null); // stores the <line> selection for toggling

  const [selected, setSelected] = useState(null);       // {id, neighbours[]}
  const [showOfficial, setShowOfficial] = useState(true);
  const [showUnofficial, setShowUnofficial] = useState(true);

  /* ────────────────────────── build once ────────────────────────── */
  useEffect(() => {
    // Guard: if linkRef already populated we’ve already drawn → skip
    if (linkRef.current) return;

    fetch("/graph.json")
      .then((res) => res.json())
      .then((data) => draw(data));

    function draw(data) {
      d3.select(svgRef.current).selectAll("*").remove();

      /* size */
      const width = window.innerWidth * 0.9;
      const height = window.innerHeight * 0.7;

      const svg = d3
        .select(svgRef.current)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("width", "100%")
        .style("height", `${height}px`)
        .style("border", "1px solid #ddd");

      const g = svg.append("g");

      svg.call(
        d3
          .zoom()
          .scaleExtent([0.2, 8])
          .on("zoom", (e) => g.attr("transform", e.transform))
      );

      /* placeholders */
      let link, node, label;

      /* simulation */
      const sim = d3
        .forceSimulation(data.nodes)
        .force(
          "link",
          d3
            .forceLink(data.links)
            .id((d) => d.id)
            .distance(140)
            .strength(0.4)
        )
        .force("charge", d3.forceManyBody().strength(-450))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(25))
        .alpha(1)
        .restart();

      /* edges */
      link = g
        .append("g")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(data.links)
        .join("line")
        .attr("stroke-width", (d) => Math.sqrt(d.weight))
        .attr("stroke", (d) => (d.kind === "official" ? "#e24" : "#bbb"));

      linkRef.current = link; // save selection for toggling later

      /* nodes */
      const sym = d3.symbol().size(320);
      node = g
        .append("g")
        .selectAll("path")
        .data(data.nodes)
        .join("path")
        .attr("d", (d) =>
          sym.type(d.type === "org" ? d3.symbolSquare : d3.symbolCircle)()
        )
        .attr("fill", (d) => palette[d.cluster % palette.length])
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.4)
        .on("mouseover", (e, d) => {
          d3.select(tooltipRef.current)
            .style("left", e.pageX + 12 + "px")
            .style("top", e.pageY + 12 + "px")
            .style("opacity", 1)
            .text(d.id);
        })
        .on("mouseout", () =>
          d3.select(tooltipRef.current).style("opacity", 0)
        )
        .on("click", (_, d) => toggleSelect(d));

      /* labels */
      label = g
        .append("g")
        .selectAll("text")
        .data(data.nodes)
        .join("text")
        .text((d) => d.id)
        .attr("font-size", 11)
        .attr("dx", 10)
        .attr("dy", 4)
        .attr("pointer-events", "none");

      /* legend + check-boxes */
      const legend = svg.append("g").attr("transform", "translate(20,20)");
      legend
        .append("rect")
        .attr("width", 150)
        .attr("height", 135)
        .attr("fill", "#fff")
        .attr("stroke", "#ccc")
        .attr("rx", 6);

      // node shapes
      legend
        .append("path")
        .attr("d", d3.symbol().type(d3.symbolCircle).size(120)())
        .attr("transform", "translate(18,26)")
        .attr("fill", "#666");
      legend
        .append("text")
        .text("Person")
        .attr("x", 38)
        .attr("y", 30)
        .style("font-size", 12);

      legend
        .append("path")
        .attr("d", d3.symbol().type(d3.symbolSquare).size(120)())
        .attr("transform", "translate(18,58)")
        .attr("fill", "#666");
      legend
        .append("text")
        .text("Organisation")
        .attr("x", 38)
        .attr("y", 62)
        .style("font-size", 12);

      // toggles
      legend
        .append("foreignObject")
        .attr("x", 10)
        .attr("y", 80)
        .attr("width", 130)
        .attr("height", 50)
        .html(`
          <div xmlns="http://www.w3.org/1999/xhtml"
               style="font-size:11px;line-height:15px;">
            <label>
              <input type="checkbox" id="chkOff" checked/> official
            </label><br/>
            <label>
              <input type="checkbox" id="chkUn" checked/> unofficial
            </label>
          </div>`);

      d3.select("#chkOff").on("input", (e) =>
        setShowOfficial(e.target.checked)
      );
      d3.select("#chkUn").on("input", (e) =>
        setShowUnofficial(e.target.checked)
      );

      /* tick */
      sim.on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
        label.attr("x", (d) => d.x).attr("y", (d) => d.y);
      });

      /* click-select helpers */
      function toggleSelect(target) {
        if (selected && selected.id === target.id) {
          setSelected(null);
          resetStyles();
          return;
        }
        const nbrs = new Set();
        data.links.forEach((l) => {
          if (l.source.id === target.id) nbrs.add(l.target.id);
          else if (l.target.id === target.id) nbrs.add(l.source.id);
        });
        nbrs.add(target.id);

        link.attr("stroke-opacity", (l) =>
          l.source.id === target.id || l.target.id === target.id ? 0.9 : 0.1
        );
        node.attr("opacity", (d) => (nbrs.has(d.id) ? 1 : 0.15));
        label.attr("opacity", (d) => (nbrs.has(d.id) ? 1 : 0.15));

        setSelected({
          id: target.id,
          neighbours: Array.from(nbrs).filter((n) => n !== target.id),
        });
      }
      function resetStyles() {
        link.attr("stroke-opacity", 0.6);
        node.attr("opacity", 1);
        label.attr("opacity", 1);
      }

      return () => sim.stop(); // cleanup
    }
  }, [showOfficial, showUnofficial, selected]); // <- deps

  /* ─ toggle edge visibility whenever flags change ─ */
  useEffect(() => {
    if (!linkRef.current) return;
    linkRef.current.attr("display", (d) => {
      if (d.kind === "official" && !showOfficial) return "none";
      if (d.kind === "unofficial" && !showUnofficial) return "none";
      return null;
    });
  }, [showOfficial, showUnofficial]);

  /* ──────────────── render ─────────────── */
  return (
    <>
      <svg ref={svgRef}></svg>

      {/* tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          padding: "4px 8px",
          background: "rgba(255,255,255,0.9)",
          border: "1px solid #ccc",
          fontSize: 12,
          borderRadius: 4,
          pointerEvents: "none",
          opacity: 0,
        }}
      />

      {/* neighbour sidebar */}
      {selected && (
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 100,
            width: 220,
            maxHeight: "60vh",
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 10,
            fontSize: 13,
          }}
        >
          <strong>{selected.id}</strong>
          <br />
          <em>Direct connections</em>
          <ul style={{ paddingLeft: 16 }}>
            {selected.neighbours.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <button
            onClick={() => setSelected(null)}
            style={{
              marginTop: 6,
              fontSize: 12,
              border: "1px solid #888",
              background: "#f8f8f8",
              padding: "2px 6px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            reset
          </button>
        </div>
      )}
    </>
  );
}
