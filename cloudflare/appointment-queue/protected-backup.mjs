// Trinity Continuum D1 emergency export protection.
// Usage: node protected-backup.mjs encrypt <export.sql> <bookmark.json> <output.enc>
//        node protected-backup.mjs verify <output.enc> [original.sql]
//        node protected-backup.mjs decrypt <output.enc> <restored.sql> <bookmark.json>
// Encryption is authenticated AES-256-GCM, with scrypt-derived key from a
// private high-entropy GitHub Actions secret, NEVER logged or stored in source.
// The encrypted artifact cannot be recovered after that passphrase is lost.
import {randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash, timingSafeEqual} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";
const cmd=process.argv[2],args=process.argv.slice(3);
const password=process.env.TRINITY_BACKUP_PASSPHRASE;
if(!password||password.length<24)throw Error("Private backup secret missing or insufficient");
const MAGIC=Buffer.from("TRINITYD1GCM1");
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
function seal(input){
  const salt=randomBytes(24),iv=randomBytes(12),key=scryptSync(password,salt,32);
  const enc=createCipheriv("aes-256-gcm",key,iv);enc.setAAD(MAGIC);
  const cipher=Buffer.concat([enc.update(input),enc.final()]);
  return Buffer.concat([MAGIC,salt,iv,enc.getAuthTag(),cipher]);
}
function unseal(bytes){
  const prefix=bytes.subarray(0,MAGIC.length);
  if(prefix.length!==MAGIC.length||!timingSafeEqual(prefix,MAGIC))throw Error("Unsupported backup version");
  const offset=MAGIC.length,salt=bytes.subarray(offset,offset+24),iv=bytes.subarray(offset+24,offset+36),tag=bytes.subarray(offset+36,offset+52);
  if(salt.length!==24||iv.length!==12||tag.length!==16)throw Error("Truncated protected backup");
  const dec=createDecipheriv("aes-256-gcm",scryptSync(password,salt,32),iv);
  dec.setAAD(MAGIC);dec.setAuthTag(tag);
  const obj=JSON.parse(Buffer.concat([dec.update(bytes.subarray(offset+52)),dec.final()]).toString("utf8"));
  if(obj.database!=="trinity-appointments-db"||!obj.sql||sha(Buffer.from(obj.sql))!==obj.sha256)throw Error("Backup integrity check failed");
  return obj;
}
if(cmd==="encrypt"&&args.length===3){
  const sql=readFileSync(args[0],"utf8");
  const bookmarkResponse=JSON.parse(readFileSync(args[1],"utf8"));
  const bookmark=bookmarkResponse?.result?.bookmark;
  if(!bookmark||sql.length<100||!sql.includes("appointments"))throw Error("Cannot protect incomplete D1 export");
  const envelope={format:1,database:"trinity-appointments-db",createdUtc:new Date().toISOString(),bookmark,sha256:sha(Buffer.from(sql)),sql};
  writeFileSync(args[2],seal(Buffer.from(JSON.stringify(envelope))),{mode:0o600});
  console.log("Encrypted D1 SQL export and pre-migration bookmark. No raw content logged.");
}else if(cmd==="verify"&&(args.length===1||args.length===2)){
  const obj=unseal(readFileSync(args[0]));
  if(args[1]&&obj.sha256!==sha(readFileSync(args[1])))throw Error("Protected export does not match original");
  console.log("PASS encrypted backup authenticated and SQL checksum matched. Bookmark present.");
}else if(cmd==="decrypt"&&args.length===3){
  const obj=unseal(readFileSync(args[0]));
  writeFileSync(args[1],obj.sql,{mode:0o600});
  writeFileSync(args[2],JSON.stringify({bookmark:obj.bookmark,createdUtc:obj.createdUtc})+"\n",{mode:0o600});
  console.log("Decryption completed to private local files; keep SQL and bookmark confidential.");
}else{
  throw Error("Expected encrypt, verify or decrypt with required file arguments");
}
