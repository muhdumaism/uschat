import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config';

export class LiveKitService {
  public static async generateToken(
    roomName: string,
    participantIdentity: string,
    participantName: string
  ): Promise<string> {
    const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
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
