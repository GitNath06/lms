const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\794fac6e-8e5f-428b-9e67-109a19c35d45\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const userInputs = [];
  for await (const line of rl) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT') {
        userInputs.push({ step: obj.step_index, content: obj.content });
      }
    } catch (e) {}
  }

  console.log('Total user inputs:', userInputs.length);
  const recent = userInputs.slice(-20);
  for (const item of recent) {
    const preview = item.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    console.log('[Step ' + item.step + '] ' + preview);
  }
}

processLineByLine();
