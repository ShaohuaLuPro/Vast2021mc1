import * as d3 from "d3";
import { useEffect, useRef } from "react";

export default function Question1() {
  const ref = useRef();

  useEffect(() => {
    const svg = d3.select(ref.current)
      .attr("width", 600)
      .attr("height", 400);

    svg.append("circle")
      .attr("cx", 300)
      .attr("cy", 200)
      .attr("r", 50)
      .attr("fill", "steelblue");
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Question 1</h2>
      <svg ref={ref}></svg>
    </div>
  );
}
