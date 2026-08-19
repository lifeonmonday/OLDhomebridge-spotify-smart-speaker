import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import SpotifyWebApi from 'spotify-web-api-node';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { SpotifySmartSpeakerAccessory } from './platformAccessory.js';

export class SpotifySmartSpeakerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public spotifyApi: SpotifyWebApi;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // Initialize Spotify Web API Instance
    this.spotifyApi = new SpotifyWebApi({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
    });

    this.log.info('Initializing Spotify Smart Speaker Platform...');

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.set(accessory.UUID, accessory);
  }

  async discoverDevices() {
    try {
      // Refresh OAuth Access Token on startup
      const data = await this.spotifyApi.refreshAccessToken();
      this.spotifyApi.setAccessToken(data.body['access_token']);
      this.log.info('Spotify Access Token successfully refreshed.');

      const deviceName = this.config.name || 'Spotify Speaker';
      const uuid = this.api.hap.uuid.generate(this.config.deviceId || 'spotify-smart-speaker');

      let accessory = this.accessories.get(uuid);

      if (!accessory) {
        this.log.info('Creating new External Accessory:', deviceName);
        accessory = new this.api.platformAccessory(deviceName, uuid);
        
        // Expose as Speaker Category
        accessory.category = this.api.hap.Categories.SPEAKER;

        new SpotifySmartSpeakerAccessory(this, accessory);

        // Publish as an External Accessory (Required for Speaker / TV logic)
        this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
      } else {
        this.log.info('Restoring existing accessory from cache:', accessory.displayName);
        new SpotifySmartSpeakerAccessory(this, accessory);
      }
    } catch (error) {
      this.log.error('Failed to initialize Spotify device discovery:', error);
    }
  }
}

/**
 * Essential export function that registers the plugin with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SpotifySmartSpeakerPlatform);
};