import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function Question1() {
  const svgRef     = useRef();
  const [nodes, setNodes]           = useState([]);
  const [links, setLinks]           = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [allIDs, setAllIDs]         = useState([]);
  const [checked, setChecked]       = useState(new Set());
  const [focusID, setFocusID]       = useState("all");

  // 1) load data once
  useEffect(() => {
    Promise.all([
      fetch("nodes.json").then(r => r.json()),
      fetch("edges.json").then(r => r.json()),
    ]).then(([rawNodes, rawLinks]) => {
      // normalize link properties
      rawLinks.forEach(l => { l._src = l.source; l._tgt = l.target; });
      setNodes(rawNodes);
      setLinks(rawLinks);

      const ids = rawNodes.map(d => d.id).sort();
      setAllIDs(ids);
      setChecked(new Set(ids));  // start with all selected
    });
  }, []);

  // 2) redraw on any state change
  useEffect(() => {
    if (!nodes.length || !links.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const width = +svg.attr("width"), height = +svg.attr("height");
    const tooltip = d3.select("#tooltip");

    // compute how many stories each source originated (outDeg) and re-used (inDeg)
    const outDeg = {}, inDeg = {};
    links.forEach(l => {
      outDeg[l._src] = (outDeg[l._src]||0) + l.count;
      inDeg[l._tgt]  = (inDeg[l._tgt] ||0) + l.count;
    });

    // ——— FILTERING ———
    //  A) first apply your "Show: all/primary/derivative" + checkbox filters
    let visNodes = nodes.filter(d =>
      (filterType === "all" || d.type === filterType) &&
      checked.has(d.id)
    );
    const visSet = new Set(visNodes.map(d => d.id));
    let visLinks = links.filter(l =>
      visSet.has(l._src) && visSet.has(l._tgt)
    );

    //  B) then, if you've picked a focus, zoom in to just that star + its neighbors
    if (focusID !== "all") {
      // keep only edges that touch focusID
      visLinks = visLinks.filter(
        l => l._src === focusID || l._tgt === focusID
      );
      // build a set of the focus and its neighbors
      const keep = new Set([focusID]);
      visLinks.forEach(l => {
        const other = l._src === focusID ? l._tgt : l._src;
        keep.add(other);
      });
      // prune nodes down to that set
      visNodes = visNodes.filter(d => keep.has(d.id));
    }

    // ——— SETUP SCALES & FORCE SIM ———
    const nodeSize  = d3.scaleSqrt([0, d3.max(Object.values(outDeg))],[4,20]);
    const linkWidth = d3.scaleLinear([1, d3.max(visLinks,d=>d.count)],[1,5]);
    const nodeColor = d=> d.type === "primary" ? "#1f77b4" : "#ff7f0e";

    const sim = d3.forceSimulation(visNodes)
        // links now push nodes a bit farther apart
        .force("link",   d3.forceLink(visLinks)
                            .id(d=>d.id)
                            .distance(150)    // ↑ was 100
                            .strength(0.2))   // ↑ was 0.1
        // nodes repel each other more strongly
        .force("charge", d3.forceManyBody()
                            .strength(-400))  // ↑ was -200
        // keep everything centered
        .force("center", d3.forceCenter(width/2, height/2))
        // collisions to avoid overlapping labels/circles
        .force("collide",d3.forceCollide(d=>nodeSize(outDeg[d.id]||0) + 12)) // ↑ was +4
        // mild centering on each axis
        .force("x",      d3.forceX(width/2).strength(0.03))
        .force("y",      d3.forceY(height/2).strength(0.03))
        .alphaDecay(0.03);


    // ——— DRAW LINKS ———
    const link = svg.append("g")
      .selectAll("line")
      .data(visLinks, d => d._src + "|" + d._tgt)
      .join("line")
        .attr("stroke", "#999")
        .attr("stroke-width", d => linkWidth(d.count))
        .on("mouseover", (event, d) => {
          const [x,y] = d3.pointer(event, svg.node());
          tooltip
            .style("opacity",1)
            .style("left",`${x+5}px`)
            .style("top",`${y+5}px`)
            .html(`
              <strong>${d._src} → ${d._tgt}</strong><br/>
              ${d.count} copies
            `);
        })
        .on("mouseout", () => tooltip.style("opacity",0));

    // ——— DRAW NODES ———
    const node = svg.append("g")
      .selectAll("circle")
      .data(visNodes, d=>d.id)
      .join("circle")
        .attr("r",    d=>nodeSize(outDeg[d.id]||0))
        .attr("fill", nodeColor)
        .call(d3.drag()
          .on("start",(e,d)=>{ if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
          .on("drag", (e,d)=>{ d.fx=e.x; d.fy=e.y; })
          .on("end",  (e,d)=>{ if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
        )
        .on("mouseover",(event,d)=>{
          const [x,y] = d3.pointer(event, svg.node());
          tooltip
            .style("opacity",1)
            .style("left",`${x+5}px`)
            .style("top", `${y+5}px`)
            .html(`
              <strong>${d.id}</strong><br/>
              Role: ${d.type}<br/>
              Stories originated: ${outDeg[d.id]||0}<br/>
              Stories re-used: ${inDeg[d.id]||0}
            `);
        })
        .on("mouseout",()=>tooltip.style("opacity",0));

    // ——— DRAW LABELS UNDERNEATH ———
    const label = svg.append("g")
      .selectAll("text")
      .data(visNodes, d=>d.id)
      .join("text")
        .text(d=>d.id)
        .attr("font-size","10px")
        .attr("text-anchor","middle");

    // ——— SIMULATION TICK ———
    sim.on("tick",()=>{
      link
        .attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
        .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      node
        .attr("cx",d=>d.x).attr("cy",d=>d.y);
      label
        .attr("x", d=>d.x)
        .attr("y", d=>d.y + nodeSize(outDeg[d.id]||0) + 12);
    });

  }, [nodes, links, filterType, checked, focusID]);

  // ——— Handlers & UI state ———
  const onFilterChange = e => setFilterType(e.target.value);
  const onFocusChange  = e => setFocusID(e.target.value);
  const toggleAll      = () => {
    if (checked.size === allIDs.length) setChecked(new Set());
    else                               setChecked(new Set(allIDs));
  };

  return (
    <div style={{ position:"relative" }}>
      <h2 style={{ textAlign:"center" }}>Question 1 – Source Dependency</h2>

      {/* tooltip */}
      <div id="tooltip" style={{
        position:"absolute", padding:"6px 10px",
        background:"rgba(0,0,0,0.75)", color:"#fff",
        borderRadius:4, pointerEvents:"none",
        fontSize:12, opacity:0
      }}/>

      {/* Left panel: Show & Focus */}
      <div style={{
        position:"absolute", top:110, left:-230,
        width:200, background:"#fff", borderRadius:6,
        boxShadow:"0 2px 6px rgba(0,0,0,0.1)", padding:12,
        fontSize:13, zIndex:100
      }}>
        <label><strong>Show:</strong>&nbsp;
          <select value={filterType} onChange={onFilterChange}>
            <option value="all">All</option>
            <option value="primary">Primary only</option>
            <option value="derivative">Derivative only</option>
          </select>
        </label>
        <div style={{ marginTop:10, fontSize:12 }}>
          <div style={{ display:"flex",alignItems:"center", marginBottom:4 }}>
            <span style={{
              width:10, height:10, background:"#1f77b4",
              display:"inline-block", marginRight:6, borderRadius:2
            }}/> Primary
          </div>
          <div style={{ display:"flex",alignItems:"center" }}>
            <span style={{
              width:10, height:10, background:"#ff7f0e",
              display:"inline-block", marginRight:6, borderRadius:2
            }}/> Derivative
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <label><strong>Focus on:</strong>&nbsp;
            <select value={focusID} onChange={onFocusChange}>
              <option value="all">All sources</option>
              {allIDs.map(id=>(
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Right panel: Toggle Sources */}
      <div style={{
        position:"absolute", top:110, right:-230,
        width:200, background:"#fff", borderRadius:6,
        boxShadow:"0 2px 6px rgba(0,0,0,0.1)", padding:12,
        fontSize:13, maxHeight:"80vh", overflowY:"auto", zIndex:100
      }}>
        <div style={{ marginBottom:6 }}>
          <strong>Toggle Sources</strong>
        </div>
        <div style={{ marginBottom:6 }}>
          <button
            onClick={toggleAll}
            style={{
              padding:"6px 10px", fontSize:12, cursor:"pointer",
              width:"100%", border:"1px solid #ccc", borderRadius:4
            }}
          >
            {checked.size === allIDs.length ? "Deselect All" : "Select All"}
          </button>
        </div>
        {allIDs.map(id=>(
          <div key={id} style={{ display:"flex", alignItems:"center", marginBottom:4 }}>
            <input
              type="checkbox"
              id={id}
              checked={checked.has(id)}
              onChange={e=>{
                const nxt = new Set(checked);
                e.target.checked ? nxt.add(id) : nxt.delete(id);
                setChecked(nxt);
              }}
            />
            <label htmlFor={id} style={{ marginLeft:6 }}>{id}</label>
          </div>
        ))}
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        width={960} height={775}
        style={{
          display:"block", margin:"80px auto 0",
          border:"1px solid #eee"
        }}
      />
    </div>
  );
}
