import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL } from './config';

export type MessageHandler = (event: string, payload: any) => void;

export class WebSocketClient {
  private static socket: WebSocket | null = null;
  private static listeners: Set<MessageHandler> = new Set();

  public static async connect() {
    const token = await AsyncStorage.getItem('@uschat/token');
    if (!token || this.socket) return;

    const wsUrl = `${WS_URL}?token=${token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('âš¡ USCHAT WebSocket Connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const { event: evt, payload } = JSON.parse(event.data);
        this.listeners.forEach((listener) => listener(evt, payload));
      } catch (err) {
        console.error('WS Frame Parse Error:', err);
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      setTimeout(() => this.connect(), 3000);
    };
  }

  public static send(event: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, payload }));
    }
  }

  public static addListener(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public static disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
