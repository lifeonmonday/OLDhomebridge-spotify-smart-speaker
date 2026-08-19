let Service, Characteristic;

module.exports = (api) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;

  api.registerPlatform("homebridge-test-speakers", "TestSpeakersPlatform", TestSpeakersPlatform);
};

class TestSpeakersPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.accessories = []; // Przechowuje zarejestrowane akcesoria

    if (api) {
      // Wywołanie wydarzenia po załadowaniu Homebridge
      this.api.on('didFinishLaunching', () => {
        this.addStandardSpeaker();
        this.addTVSpeaker();
      });
    }
  }

  // Wymagana metoda dla wtyczek typu Dynamic Platform (obsługuje cache)
  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }

  // --- 1. ZWYKŁY GŁOŚNIK (Service.Speaker + Volume) ---
  addStandardSpeaker() {
    const uuid = this.api.hap.uuid.generate("test-standard-speaker");
    const accessory = new this.api.platformAccessory("Testowy Głośnik", uuid);

    let currentVolume = 20;
    let isMuted = false;

    const speakerService = accessory.addService(Service.Speaker, "Głośnik Zwykły");

    speakerService.getCharacteristic(Characteristic.Mute)
      .onGet(() => isMuted)
      .onSet((value) => {
        isMuted = value;
        this.log.info(`[Głośnik Zwykły] Mute: ${isMuted}`);
      });

    speakerService.addCharacteristic(Characteristic.Volume)
      .onGet(() => currentVolume)
      .onSet((value) => {
        currentVolume = value;
        this.log.info(`[Głośnik Zwykły] Ustawiono głośność: ${currentVolume}%`);
      });

    this.api.registerPlatformAccessories("homebridge-test-speakers", "TestSpeakersPlatform", [accessory]);
    this.log.info("Zarejestrowano: Zwykły Głośnik");
  }

  // --- 2. GŁOŚNIK TV (Service.Television + Service.TelevisionSpeaker) ---
  addTVSpeaker() {
    const uuid = this.api.hap.uuid.generate("test-tv-speaker");
    
    // Ważne: Akcesoria TV w Homebridge wymagają kategorii TELEVISION
    const accessory = new this.api.platformAccessory(
      "Testowy TV Głośnik", 
      uuid, 
      this.api.hap.Categories.TELEVISION
    );

    let tvPower = false;
    let tvVolume = 30;
    let tvMuted = false;

    // A. Główna usługa Television
    const tvService = accessory.addService(Service.Television, "Głośnik TV");
    tvService.setCharacteristic(Characteristic.ConfiguredName, "Głośnik TV");
    tvService.setCharacteristic(
      Characteristic.SleepDiscoveryMode,
      Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
    );

    tvService.getCharacteristic(Characteristic.Active)
      .onGet(() => (tvPower ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE))
      .onSet((value) => {
        tvPower = value === Characteristic.Active.ACTIVE;
        this.log.info(`[Głośnik TV] Zasilanie: ${tvPower ? "ON" : "OFF"}`);
      });

    // B. Usługa powiązana TelevisionSpeaker
    const tvSpeakerService = accessory.addService(Service.TelevisionSpeaker, "Głośnik TV Audio");

    tvSpeakerService.setCharacteristic(
      Characteristic.Active,
      Characteristic.Active.ACTIVE
    );

    tvSpeakerService.setCharacteristic(
      Characteristic.VolumeControlType,
      Characteristic.VolumeControlType.ABSOLUTE
    );

    tvSpeakerService.getCharacteristic(Characteristic.Mute)
      .onGet(() => tvMuted)
      .onSet((value) => {
        tvMuted = value;
        this.log.info(`[Głośnik TV] Mute: ${tvMuted}`);
      });

    tvSpeakerService.addCharacteristic(Characteristic.Volume)
      .onGet(() => tvVolume)
      .onSet((value) => {
        tvVolume = value;
        this.log.info(`[Głośnik TV] Ustawiono głośność: ${tvVolume}%`);
      });

    tvSpeakerService.getCharacteristic(Characteristic.VolumeSelector)
      .onSet((value) => {
        const step = 5;
        if (value === Characteristic.VolumeSelector.INCREMENT) {
          tvVolume = Math.min(100, tvVolume + step);
        } else if (value === Characteristic.VolumeSelector.DECREMENT) {
          tvVolume = Math.max(0, tvVolume - step);
        }
        this.log.info(`[Głośnik TV] Przycisk fizyczny (+/-). Nowa głośność: ${tvVolume}%`);
      });

    tvService.addLinkedService(tvSpeakerService);

    // Akcesoria TV rejestrujemy jako External Accessories, aby iOS poprawnie je wykrył jako TV
    this.api.registerPlatformAccessories("homebridge-test-speakers", "TestSpeakersPlatform", [accessory]);
    this.log.info("Zarejestrowano: TV Głośnik");
  }
}
