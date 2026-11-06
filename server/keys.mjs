// Makes the key pair the payment server signs its grants with:
//   node server/keys.mjs
// The private key goes to the server as the secret GRANT_KEY (never into the repository); the public key goes to
// package.json as "store": { "publicKey": … } so the game can check the grants.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('jwk', publicKey);
const priv = await crypto.subtle.exportKey('jwk', privateKey);
console.log('GRANT_KEY (secret for the server, keep it private):');
console.log(JSON.stringify(priv));
console.log('\npublicKey (package.json → "store"):');
console.log(JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
