// buildNewsDependency.cjs
// Usage: node buildNewsDependency.cjs

const fs      = require('fs');
const path    = require('path');
const glob    = require('glob');
const natural = require('natural');

const NEWS_DIR     = path.join(__dirname, 'MC1', 'News Articles');
const OUTPUT_DIR   = path.join(__dirname, 'output');
const SIM_THRESHOLD = 0.5;

// Month lookup for "DD MonthName YYYY"
const MONTHS = {
  january:0, february:1, march:2, april:3,
  may:4, june:5, july:6, august:7,
  september:8, october:9, november:10, december:11
};

// Parse both "YYYY/MM/DD" and "DD MonthName YYYY"
function parseDate(str) {
  let d = new Date(str);
  if (!isNaN(d)) return d;
  const m = str.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const day = +m[1], mon = MONTHS[m[2].toLowerCase()], year = +m[3];
    if (mon !== undefined) return new Date(year, mon, day);
  }
  return null;
}

// Ensure output directory
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

/**
 * 1) Load articles with robust header parsing and per-file logging
 */
function loadArticles() {
  const files = glob.sync(path.join(NEWS_DIR,'*','*.txt'));
  console.log(`[DEBUG] Found ${files.length} files to load`);
  const docs = [];

  files.forEach((fp, idx) => {
    console.log(`Reading (${idx+1}/${files.length}): ${fp}`);
    const content = fs.readFileSync(fp,'utf8');
    const lines   = content.split(/\r?\n/);

    // Collect header lines
    const headerLines = [];
    let i = 0;
    for (; i < lines.length; i++) {
      const L = lines[i].trim();
      if (L === '') continue;
      if (/^(SOURCE|TITLE|AUTHOR|PUBLISHED|PUBLISHER|LOCATION):/.test(L)) {
        headerLines.push(L);
        continue;
      }
      break;
    }

    const body = lines.slice(i).join('\n').trim();
    const pubLine = headerLines.find(L=>L.startsWith('PUBLISHED:'));
    let pubDate = null;
    if (pubLine) {
      const m = pubLine.match(/^PUBLISHED:\s*(.+)$/);
      if (m) pubDate = parseDate(m[1]);
    }

    if (pubDate instanceof Date && !isNaN(pubDate)) {
      docs.push({
        source:   path.basename(path.dirname(fp)),
        filename: path.basename(fp),
        text:     body,
        date:     pubDate
      });
    } else {
      console.warn(`  [WARN] Skipping (no valid date): ${fp}`);
    }
  });

  console.log(`[DEBUG] Loaded ${docs.length} articles with valid dates`);
  return docs;
}

// 2) Build TF–IDF
function buildTfidf(docs) {
  const tfidf = new natural.TfIdf();
  docs.forEach(d=>tfidf.addDocument(d.text));
  return tfidf;
}

// 3) Extract vectors
function getVectors(tfidf, docs) {
  const vocab = [...new Set(tfidf.documents.flatMap(d=>Object.keys(d)))];
  const vectors = docs.map((_,i) => {
    const v = Array(vocab.length).fill(0);
    vocab.forEach((t,j)=> v[j]=tfidf.tfidf(t,i));
    return v;
  });
  return { vocab, vectors };
}

// Cosine similarity
function cosine(a,b) {
  let dot=0, mA=0, mB=0;
  for(let k=0;k<a.length;k++){
    dot += a[k]*b[k];
    mA  += a[k]*a[k];
    mB  += b[k]*b[k];
  }
  return mA&&mB ? dot/(Math.sqrt(mA)*Math.sqrt(mB)) : 0;
}

// 4) Build edges only from earlier→later
function buildEdges(docs,vectors) {
  const edges = [];
  docs.forEach((dA,i) => {
    docs.forEach((dB,j) => {
      if(i===j || dA.date >= dB.date) return;
      const sim = cosine(vectors[i],vectors[j]);
      if(sim>=SIM_THRESHOLD){
        edges.push({ source:dA.source, target:dB.source, weight:sim });
      }
    });
  });
  console.log(`🔗 Raw edges ≥${SIM_THRESHOLD}: ${edges.length}`);
  return edges;
}

// 5) Aggregate edges
function aggregateEdges(edges) {
  const map={};
  edges.forEach(({source,target})=>{
    const k=`${source}→${target}`;
    map[k]=(map[k]||0)+1;
  });
  const agg=Object.entries(map).map(([k,c])=>{
    const [source,target]=k.split('→');
    return { source, target, count:c };
  });
  console.log(`🔢 Aggregated edges: ${agg.length}`);
  return agg;
}

// 6) Classify nodes
function classifyNodes(aggEdges,docs) {
  const outDeg={}, inDeg={};
  aggEdges.forEach(({source,target,count})=>{
    outDeg[source]=(outDeg[source]||0)+count;
    inDeg[target]=(inDeg[target]||0)+count;
  });
  const outlets=[...new Set(docs.map(d=>d.source))];
  const logs=outlets.map(id=>
    Math.log(((outDeg[id]||0)+1)/((inDeg[id]||0)+1))
  ).sort((a,b)=>a-b);
  const mid=Math.floor(logs.length/2);
  const median=logs.length%2?logs[mid]:(logs[mid-1]+logs[mid])/2;
  const nodes=outlets.map(id=>{
    const r=Math.log(((outDeg[id]||0)+1)/((inDeg[id]||0)+1));
    return { id, type:r>median?'primary':'derivative', out:outDeg[id]||0, inn:inDeg[id]||0 };
  });
  console.log(`🗂 Classified nodes: ${nodes.length}`);
  return nodes;
}

// 7) Write outputs
function writeOutputs(nodes,edges) {
  fs.writeFileSync(path.join(OUTPUT_DIR,'nodes.json'),JSON.stringify(nodes,null,2));
  fs.writeFileSync(path.join(OUTPUT_DIR,'edges.json'),JSON.stringify(edges,null,2));
  console.log('✅ Wrote nodes.json & edges.json');
}

// Main pipeline
(async()=>{
  console.log('📥 Loading articles…');
  const docs=loadArticles();
  console.log('📊 TF–IDF…'); const tfidf=buildTfidf(docs);
  console.log('🔢 Vectors…'); const {vectors}=getVectors(tfidf,docs);
  console.log('🔍 Edges…'); const raw=buildEdges(docs,vectors);
  console.log('📈 Aggregate…'); const agg=aggregateEdges(raw);
  console.log('🏷 Classify…'); const nodes=classifyNodes(agg,docs);
  console.log('💾 Write…'); writeOutputs(nodes,agg);
})();
