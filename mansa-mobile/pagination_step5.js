const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldTeamPerf = /const teamStats = employees\.map\(emp => \{[\s\S]*?return \{\s*emp,\s*total,\s*delivered,\s*returned,\s*cancelled,\s*pending\s*\};\s*\}\);/;
const newTeamPerf = `// teamStats is already loaded from state!`;

if (oldTeamPerf.test(content)) {
  content = content.replace(oldTeamPerf, newTeamPerf);
  fs.writeFileSync('App.js', content);
  console.log("Successfully replaced Team Performance logic");
} else {
  console.log("Failed to find Team Performance logic");
}
