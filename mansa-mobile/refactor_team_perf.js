const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldTeamPerf = /const teamStats = employees\.map\(emp => \{[\s\S]*?return \{\s*emp,\s*total,\s*delivered,\s*returned,\s*cancelled,\s*pending\s*\};\s*\}\);/g;
const newTeamPerf = `// teamStats is already loaded from state in the new fetch logic!`;

if (oldTeamPerf.test(content)) {
  content = content.replace(oldTeamPerf, newTeamPerf);
  fs.writeFileSync('App.js', content);
  console.log("Replaced Team Performance logic successfully.");
} else {
  console.log("Could not match Team Performance block.");
}
