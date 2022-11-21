import bencode from "bencode";
import fs from "fs/promises";
import dgram from "dgram";
import { Buffer } from "buffer";
import crypto from "crypto";

const Client = dgram.createSocket("udp4");
let metaInfo, transactionID, connectionPacket, announcePacket, metaInfoLength;
let connectionID = 0x41727101980n;
transactionID = crypto.randomBytes(4).readInt32BE();
let workingTrackers = [];
let peerInfo = [];
Client.on("message", (Msg, Info) => {
    if (!Buffer.compare(Msg.subarray(0, 4), Buffer.from([0, 0, 0, 0]))) {
        const GoodTracker = {
            hostname: Info.address,
            port: Info.port,
            transactionID: Msg.subarray(4, 8).readInt32BE(),
            connectionID: Msg.subarray(8, 16).readBigInt64BE(),
        }
        workingTrackers.push(GoodTracker);
    } else if (!Buffer.compare(Msg.subarray(0, 4), Buffer.from([0, 0, 0, 1]))) {
        function getIPs() {
            let Peers = Msg.subarray(20,Msg.byteLength)
            let IP = []
            for(let i = 0;i < Peers.length-1; i= i+6) {
                IP.push(Peers.subarray(i,i+4).join("."))
            }
            return IP
        }
        console.log(getIPs())
        function getPorts() {
            let Peers = Msg.subarray(20,Msg.byteLength)
            let Port = []
            for(let i = 0;i < Peers.length-1; i= i+6) {
                Port.push(Peers.subarray(i+4,i+6).join(""))
            }
            return Port
        }
        console.log(getPorts())
        peerInfo.push({
            transactionID: Msg.subarray(4, 8).readInt32BE(),
            interval: Msg.subarray(8, 12),
            leechers: Msg.subarray(12, 16),
            seeders: Msg.subarray(16,20),
            ip: getIPs(),
            port: getPorts(),
        })
    }
})
Client.on("error", (Error) => {
    console.log(Error);
})

async function setMetaInfo(File) {
    const Buffer = await fs.readFile(File);
    metaInfo = await bencode.decode(Buffer, "utf8");
    if (!metaInfo.info.length) {
        let length = 0;
        for (let i = 0; i <= metaInfo.info.files.length - 1; i++) {
            length += metaInfo.info.files[i].length;
        }
        metaInfoLength = length;
    }
}
async function getHash(Str, Alg) {
    return crypto.createHash(Alg).update(Str.toString()).digest("hex");
}
await setMetaInfo("./test2.torrent");
async function getWorkingTracker() {
    let Trackers = [];
    connectionPacket = Buffer.allocUnsafe(16);
    connectionPacket.writeBigInt64BE(connectionID, 0);
    connectionPacket.writeInt32BE(0, 8);
    connectionPacket.writeInt32BE(transactionID, 12);
    for (let i = 0; i <= metaInfo["announce-list"].length - 1; i++) {
        const baseURL = new URL(metaInfo["announce-list"][i][0]);
        if (baseURL.port == 80 || !baseURL.port) {
            baseURL.port = 8080;
            Trackers.push(baseURL);
        } else {
            Trackers.push(baseURL);
        }
    }
    for (let i = 0; i <= Trackers.length - 1; i++) {
        Client.send(connectionPacket, Trackers[i].port, Trackers[i].hostname, (Err) => {
            if (Err) {
                //console.log(Err);
            } else {
                console.log("Msg Sent");
            }
        });
    }
}
await getWorkingTracker();
await new Promise(x => setTimeout(x, 2500));
async function getPeers() {
    let randomTracker = workingTrackers[crypto.randomInt(0, workingTrackers.length)]
    announcePacket = Buffer.alloc(98);
    announcePacket.writeBigInt64BE(randomTracker.connectionID, 0);
    announcePacket.writeInt32BE(1, 8);
    announcePacket.writeInt32BE(randomTracker.transactionID, 12);
    announcePacket.write((await getHash(metaInfo.info, "sha1")).toString(), 16);
    announcePacket.write("-AP0001-234661362160", 36);
    announcePacket.writeBigInt64BE(0n, 56);
    announcePacket.writeBigInt64BE(BigInt(metaInfoLength || metaInfo.info.length), 64);
    announcePacket.writeBigInt64BE(0n, 72);
    announcePacket.writeInt32BE(2, 80);
    announcePacket.writeInt32BE(0, 84);
    announcePacket.writeInt32BE(0, 88);
    announcePacket.writeInt32BE(30, 92);
    announcePacket.writeInt16BE(6969, 96);
    Client.send(announcePacket, randomTracker.port, randomTracker.hostname, (Err) => {
        if (Err) {
            //console.log(Err);
        } else {
            console.log("Announce Msg Sent");
        }
    });
}
await getPeers()
await new Promise(x => setTimeout(x, 2500));
async function PWP() {
    console.log(peerInfo)
}

await PWP()