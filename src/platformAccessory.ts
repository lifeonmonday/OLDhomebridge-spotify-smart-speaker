import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SpotifySmartSpeakerPlatform } from './platform.js';

export class SpotifySmartSpeakerAccessory {
  private service: Service;
  private currentMediaState: number;
  private targetMediaState: number;

  constructor(
    private readonly platform: SpotifySmartSpeakerPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Default HomeKit media states to Paused (1)
    this.currentMediaState = this.platform.Characteristic.CurrentMediaState.PAUSE;
    this.targetMediaState = this.platform.Characteristic.TargetMediaState.PAUSE;

    // Set Accessory Information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Spotify')
      .setCharacteristic(this.platform.Characteristic.Model, 'Connect Speaker')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.platform.config.deviceId || '123456');

    // Use Television service to unlock native Control Center widgets
    this.service = this.accessory.getService(this.platform.Service.Television) ||
                   this.accessory.addService(this.platform.Service.Television);

    // Required Television & Remote Control Characteristics
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);
    this.service.setCharacteristic(
      this.platform.Characteristic.SleepDiscoveryMode,
      this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );

    // Active state (On / Off)
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(() => this.platform.Characteristic.Active.ACTIVE);

    // Media State Handlers
    this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
      .onGet(this.getCurrentMediaState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetMediaState)
      .onGet(() => this.targetMediaState)
      .onSet(this.setTargetMediaState.bind(this));

    // Remote Key Press Handlers (Control Center Play/Pause button)
    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .onSet(this.handleRemoteKeyPress.bind(this));

    // Start background state polling every 5 seconds
    setInterval(() => this.pollSpotifyState(), 5000);
  }

  async getCurrentMediaState(): Promise<CharacteristicValue> {
    return this.currentMediaState;
  }

  async setTargetMediaState(value: CharacteristicValue) {
    this.targetMediaState = value as number;

    try {
      await this.refreshAccessTokenIfNeeded();

      if (value === this.platform.Characteristic.TargetMediaState.PLAY) {
        this.platform.log.info('Setting Spotify playback to PLAY');
        await this.platform.spotifyApi.play({ device_id: this.platform.config.deviceId });
        this.currentMediaState = this.platform.Characteristic.CurrentMediaState.PLAY;
      } else if (value === this.platform.Characteristic.TargetMediaState.PAUSE) {
        this.platform.log.info('Setting Spotify playback to PAUSE');
        await this.platform.spotifyApi.pause({ device_id: this.platform.config.deviceId });
        this.currentMediaState = this.platform.Characteristic.CurrentMediaState.PAUSE;
      }

      this.service.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.currentMediaState);
    } catch (error) {
      this.platform.log.error('Failed to update Spotify playback state:', error);
    }
  }

  async handleRemoteKeyPress(value: CharacteristicValue) {
    if (value === this.platform.Characteristic.RemoteKey.PLAY_PAUSE) {
      const newState = this.currentMediaState === this.platform.Characteristic.CurrentMediaState.PLAY
        ? this.platform.Characteristic.TargetMediaState.PAUSE
        : this.platform.Characteristic.TargetMediaState.PLAY;

      await this.setTargetMediaState(newState);
    }
  }

  async pollSpotifyState() {
    try {
      await this.refreshAccessTokenIfNeeded();
      const response = await this.platform.spotifyApi.getMyCurrentPlaybackState();

      if (response.body && response.body.is_playing) {
        this.currentMediaState = this.platform.Characteristic.CurrentMediaState.PLAY;
        this.targetMediaState = this.platform.Characteristic.TargetMediaState.PLAY;
      } else {
        this.currentMediaState = this.platform.Characteristic.CurrentMediaState.PAUSE;
        this.targetMediaState = this.platform.Characteristic.TargetMediaState.PAUSE;
      }

      this.service.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.currentMediaState);
      this.service.updateCharacteristic(this.platform.Characteristic.TargetMediaState, this.targetMediaState);
    } catch (error) {
      // Silently handle transient polling errors
    }
  }

  private async refreshAccessTokenIfNeeded() {
    try {
      const data = await this.platform.spotifyApi.refreshAccessToken();
      this.platform.spotifyApi.setAccessToken(data.body['access_token']);
    } catch (error) {
      this.platform.log.error('Error refreshing Spotify access token:', error);
    }
  }
}