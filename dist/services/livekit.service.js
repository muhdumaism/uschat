"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveKitService = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const config_1 = require("../config");
class LiveKitService {
    static async generateToken(roomName, participantIdentity, participantName) {
        const token = new livekit_server_sdk_1.AccessToken(config_1.config.livekit.apiKey, config_1.config.livekit.apiSecret, {
            identity: participantIdentity,
            name: participantName,
            ttl: '2h',
        });
        token.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });
        return await token.toJwt();
    }
}
exports.LiveKitService = LiveKitService;
