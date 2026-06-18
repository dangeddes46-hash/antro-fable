const { createHash } = require('crypto');

function parseArgs(argv) {
  const args = {
    pepper: process.env.TOKEN_HASH_PEPPER || '',
    token: '',
  };

  const parts = argv.slice(2);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === '--pepper') {
      args.pepper = parts[i + 1] || '';
      i += 1;
      continue;
    }
    if (!args.token) {
      args.token = part;
    } else {
      args.token += ` ${part}`;
    }
  }

  return args;
}

function hashToken(rawToken, pepper) {
  return createHash('sha256').update(`${pepper}${rawToken}`, 'utf8').digest('hex');
}

function main() {
  const { token, pepper } = parseArgs(process.argv);
  const trimmed = String(token || '').trim();

  if (!trimmed) {
    console.error('Usage: node scripts/hash-token.js <raw-token> [--pepper <value>]');
    process.exit(1);
  }

  const tokenHash = hashToken(trimmed, pepper);
  const tokenPrefix = tokenHash.slice(0, 8);

  console.log(JSON.stringify({
    tokenHash,
    tokenPrefix,
    tokenLength: trimmed.length,
  }, null, 2));
}

main();
