// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function init_radar(config) {

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  var seed = 42;
  function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  // radial_min / radial_max are multiples of PI
  const quadrants = [
    { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 },
    { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 },
    { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 },
    { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 }
  ];

  const rings = [
    { radius: 130 },
    { radius: 220 },
    { radius: 310 },
    { radius: 400 }
  ];

  const title_offset =
    { x: -675, y: -420 };

  const footer_offset =
    { x: -675, y: 420 };

  const legend_offset = [
    { x: 450, y: 90 },
    { x: -675, y: 90 },
    { x: -675, y: -310 },
    { x: 450, y: -310 }
  ];

  function polar(cartesian) {
    var x = cartesian.x;
    var y = cartesian.y;
    return {
      t: Math.atan2(y, x),
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    var low = Math.min(min, max);
    var high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }

  function bounded_ring(polar, r_min, r_max) {
    return {
      t: polar.t,
      r: bounded_interval(polar.r, r_min, r_max)
    }
  }

  function bounded_box(point, min, max) {
    return {
      x: bounded_interval(point.x, min.x, max.x),
      y: bounded_interval(point.y, min.y, max.y)
    }
  }

  function segment(quadrant, ring) {
    var polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: ring === 0 ? 30 : rings[ring - 1].radius
    };
    var polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[ring].radius
    };
    var cartesian_min = {
      x: 15 * quadrants[quadrant].factor_x,
      y: 15 * quadrants[quadrant].factor_y
    };
    var cartesian_max = {
      x: rings[3].radius * quadrants[quadrant].factor_x,
      y: rings[3].radius * quadrants[quadrant].factor_y
    };
    return {
      clipx: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.x = cartesian(p).x; // adjust data too!
        return d.x;
      },
      clipy: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.y = cartesian(p).y; // adjust data too!
        return d.y;
      },
      random: function() {
        return cartesian({
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        });
      }
    }
  }

  // position each entry randomly in its segment
  for (var i = 0; i < config.entries.length; i++) {
    var entry = config.entries[i];
    entry.segment = segment(entry.quadrant, entry.ring);
    var point = entry.segment.random();
    entry.x = point.x;
    entry.y = point.y;
    entry.color = entry.inactive ? config.colors.inactive : config.rings[entry.ring].color;
  }

  // partition entries according to segments
  var segmented = new Array(4);
  for (var quadrant = 0; quadrant < 4; quadrant++) {
    segmented[quadrant] = new Array(4);
    for (var ring = 0; ring < 4; ring++) {
      segmented[quadrant][ring] = [];
    }
  }
  for (var i=0; i<config.entries.length; i++) {
    var entry = config.entries[i];
    segmented[entry.quadrant][entry.ring].push(entry);
  }

  // assign unique sequential id to each entry
  var id = 1;
  for (var quadrant of [2,3,1,0]) {
    for (var ring = 0; ring < 4; ring++) {
      var entries = segmented[quadrant][ring];
      entries.sort(function(a,b) { return a.label.localeCompare(b.label); })
      for (var i=0; i<entries.length; i++) {
        entries[i].id = "" + id++;
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function viewbox(quadrant) {
    return [
      Math.max(0, quadrants[quadrant].factor_x * 400) - 420,
      Math.max(0, quadrants[quadrant].factor_y * 400) - 420,
      440,
      440
    ].join(" ");
  }

  var svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width", config.width)
    .attr("height", config.height);

  var radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(config.width / 2, config.height / 2));
  }

  var grid = radar.append("g");

  // draw rings
  for (var i = 0; i < rings.length; i++) {
    grid.append("text")
      .text(config.rings[i].name)
      .attr("y", -rings[i].radius + 62)
      .attr("text-anchor", "middle")
      .style("fill", config.colors.rings)
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "42px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .style("user-select", "none");
    grid.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rings[i].radius)
      .style("fill", "none")
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
  }

  // draw grid lines
  grid.append("line")
    .attr("x1", 0).attr("y1", -400)
    .attr("x2", 0).attr("y2", 400)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);
  grid.append("line")
    .attr("x1", -400).attr("y1", 0)
    .attr("x2", 400).attr("y2", 0)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);

  // background color. Usage `.attr("filter", "url(#solid)")`
  // SOURCE: https://stackoverflow.com/a/31013492/2609980
  var defs = grid.append("defs");
  var filter = defs.append("filter")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1)
    .attr("id", "solid");
  filter.append("feFlood")
    .attr("flood-color", "rgb(0, 0, 0, 0.8)");
  filter.append("feComposite")
    .attr("in", "SourceGraphic");

  function calculate_offset(d, index) {
    const { x: originX, y: originY, moved = 0, ring: originRing } = d

    const x2 = Math.pow(originX, 2)
    const y2 = Math.pow(originY, 2)
    const z = Math.sqrt(x2 + y2)

    const endRing = originRing + moved
    let distance = 0
    const max = Math.max(originRing, endRing)
    const min = Math.min(originRing, endRing)
    for (let i = max; i > min; i --) {
      const r1 = rings[i].radius
      const r2 = rings[i - 1] ? rings[i - 1].radius : 0
      const d = r1 - r2
      distance += d
    }

    const direction = moved > 0 ? -1 : 1 // 当moved为正数时，往里面移动
    const endZ = z + distance * direction // 移动后的斜边长度

    const rate = endZ / z // 移动后的斜边比上移动前的斜边

    const endX = originX * rate
    const endY = originY * rate

    const x = originX - endX
    let y = originY - endY

    return {
      x,
      y,
    }
  }

  function calculate_position(quadrant, ring, index=null) {
    var dx = ring < 2 ? 0 : 120;
    var dy = (index == null ? -16 : index * 12);
    if (ring % 2 === 1) {
      dy = dy + 36 + segmented[quadrant][ring-1].length * 12;
    }
    const x = legend_offset[quadrant].x + dx
    const y = legend_offset[quadrant].y + dy
    return { x, y }
  }

  function legend_transform(quadrant, ring, index=null) {
    const { x, y } = calculate_position(quadrant, ring, index)
    return translate(x, y);
  }

  // draw title and legend (only in print layout)
  // title
  if (config.title) {
    radar.append("text")
      .attr("transform", translate(title_offset.x, title_offset.y))
      .text(config.title)
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "34px");
  }

  // footer
  // const footer = radar.append("g")
  //   .attr("transform", translate(footer_offset.x, footer_offset.y))
  //   // .text("▲ moved up     ▼ moved down")
  //   // .attr("xml:space", "preserve")
  //   // .style("font-family", "Arial, Helvetica")
  //   // .style("font-size", "10px");

  // legend
  if (!config.hide_legend) {
    var legend = radar.append("g");
    for (var quadrant = 0; quadrant < 4; quadrant++) {
      legend.append("text")
        .attr("transform", translate(
          legend_offset[quadrant].x,
          legend_offset[quadrant].y - 45
        ))
        .text(config.quadrants[quadrant].name)
        .style("font-family", "Arial, Helvetica")
        .style("font-size", "18px");
      for (var ring = 0; ring < 4; ring++) {
        legend.append("text")
          .attr("transform", legend_transform(quadrant, ring))
          .text(config.rings[ring].name)
          .style("font-family", "Arial, Helvetica")
          .style("font-size", "12px")
          .style("font-weight", "bold");
        legend.selectAll(".legend" + quadrant + ring)
          .data(segmented[quadrant][ring])
          .enter()
            .append("a")
              .attr("href", function (d, i) {
                return d.link ? d.link : null; // stay on same page if no link was provided
              })
            .append("text")
              .attr("transform", function(d, i) { return legend_transform(quadrant, ring, i); })
              .attr("class", "legend" + quadrant + ring)
              .attr("id", function(d, i) { return "legendItem" + d.id; })
              .text(function(d, i) { return d.id + ". " + d.label; })
              .style("font-family", "Arial, Helvetica")
              .style("font-size", "11px")
              .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
              .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); });
      }
    }
  }

  // layer for entries
  var rink = radar.append("g")
    .attr("id", "rink");

  // rollover bubble (on top of everything else)
  var bubble = radar.append("g")
    .attr("id", "bubble")
    .attr("x", 0)
    .attr("y", 0)
    .style("opacity", 0)
    .style("pointer-events", "none")
    .style("user-select", "none");
  bubble.append("rect")
    .attr("rx", 4)
    .attr("ry", 4)
    .style("fill", "#333");
  bubble.append("text")
    .style("font-family", "sans-serif")
    .style("font-size", "10px")
    .style("fill", "#fff");
  bubble.append("path")
    .attr("d", "M 0,0 10,0 5,8 z")
    .style("fill", "#333");

  function showBubble(d) {
    var tooltip = d3.select("#bubble text")
      .text(d.label);
    var bbox = tooltip.node().getBBox();
    d3.select("#bubble")
      .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
      .style("opacity", 0.8);
    d3.select("#bubble rect")
      .attr("x", -5)
      .attr("y", -bbox.height)
      .attr("width", bbox.width + 10)
      .attr("height", bbox.height + 4);
    d3.select("#bubble path")
      .attr("transform", translate(bbox.width / 2 - 5, 3));
  }

  function hideBubble(d) {
    d3.select("#bubble")
      .attr("transform", translate(0,0))
      .style("opacity", 0);
  }

  function highlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    if (legendItem) {
      legendItem.setAttribute("filter", "url(#solid)");
      legendItem.setAttribute("fill", "white");
    }
  }

  function unhighlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    if (legendItem) {
      legendItem.removeAttribute("filter");
      legendItem.removeAttribute("fill");
    }
  }

  // draw blips on radar
  var blips = rink.selectAll(".blip")
    .data(config.entries)
    .enter()
      .append("g")
        .attr("class", "blip")
        .attr("transform", function(d, i) { return legend_transform(d.quadrant, d.ring, i); })
        .on("mouseover", function(d, i) {
          showBubble(d);
          highlightLegendItem(d);

          const item = d3.select(this)
          const { x, y } = calculate_offset(d, i)

          item.selectAll('circle.move-to')
            .attr('transform', translate(x, y))
            .style('display', '')

          item.selectAll('line.move-to')
            .attr('x2', x)
            .attr('y2', y)
            .style('display', '')
        })
        .on("mouseout", function(d) {
          hideBubble(d);
          unhighlightLegendItem(d);
          d3.select(this).selectAll('.move-to')
            .style('display', 'none')
        })

  // configure each blip
  blips.each(function(d, i) {
    var blip = d3.select(this);

    // 先画线，避免线遮住实心
    if (d.moved) {
      blip.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr('class', 'move-to')
        .style('display', 'none')
        .style("stroke", config.colors.inactive)
        .style("stroke-width", 2)

      blip.append("circle")
        .attr("r", 3)
        .attr("fill", config.colors.inactive)
        .attr('class', 'move-to')
        .style('display', 'none')

      const angle = Math.atan2(d.y, d.x)
      const deg = angle * 180 / Math.PI
      const rotate = d.moved < 0 ? deg - 100 : deg + 90

      blip.append("circle")
        .attr("r", 11)
        .attr("fill", 'none')
        .attr('stroke', d.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', 35)
        .attr('transform', `rotate(${rotate})`)
    }

    // blip shape
    blip.append("circle")
      .attr("r", 9)
      .attr("fill", d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // blip text
    var blip_text = d.id || d.label.match(/[a-z]/i);
    blip.append("text")
      .text(blip_text)
      .attr("y", 3)
      .attr("text-anchor", "middle")
      .style("fill", "#fff")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", function(d) { return blip_text.length > 2 ? "8px" : "9px"; })
      .style("pointer-events", "none")
      .style("user-select", "none");
  });

  // make sure that blips stay inside their segment
  function ticked() {
    blips.attr("transform", function(d) {
      return translate(d.segment.clipx(d), d.segment.clipy(d));
    })
  }

  // distribute blips, while avoiding collisions
  d3.forceSimulation()
    .nodes(config.entries)
    .velocityDecay(0.19) // magic number (found by experimentation)
    .force("collision", d3.forceCollide().radius(12).strength(0.85))
    .on("tick", ticked);
}
