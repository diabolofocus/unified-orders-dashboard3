import { settingsStore } from '../stores/SettingsStore';
import { DEFAULT_NOTIFICATION_SOUND } from '../assets/defaultNotificationSound';

export class SoundService {
  private audioContext: AudioContext | null = null;
  private soundBuffer: AudioBuffer | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized || !settingsStore.soundAlert) return true;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Convert base64 to ArrayBuffer
      const audioData = DEFAULT_NOTIFICATION_SOUND.split(',')[1];
      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      this.soundBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Sound initialization failed:', error);
      return false;
    }
  }

  async play() {
    if (!this.soundBuffer || !this.audioContext || !settingsStore.soundAlert) return;

    try {
      // Resume the audio context in case it was suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      const source = this.audioContext.createBufferSource();
      source.buffer = this.soundBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      
      // Set up auto-cleanup when the sound finishes playing
      source.onended = () => {
        source.disconnect();
      };
    } catch (error) {
      console.error('Error playing sound:', error);
      
      // If we get a NotAllowedError, it means we need user interaction first
      if ((error as Error).name === 'NotAllowedError') {
        console.warn('Audio playback was blocked. User interaction is required to play sounds.');
      }
    }
  }
  
  // Call this method after user interaction to enable audio
  async enableAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        return true;
      } catch (error) {
        console.error('Failed to enable audio:', error);
        return false;
      }
    }
    return true;
  }

  // Optional: Clean up resources
  async dispose() {
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        try {
          await this.audioContext.close();
        } catch (error) {
          console.error('Error closing audio context:', error);
        }
      }
      this.audioContext = null;
    }
    this.soundBuffer = null;
    this.isInitialized = false;
  }
}

// Export a single instance (not a singleton, just a default instance)
export const soundService = new SoundService();
