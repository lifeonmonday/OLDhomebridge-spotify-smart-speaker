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

    this.accessories = [];

    // Po załadowaniu Homebridge rejestrujemy akcesoria testowe
    this.api.on('didFinishLaunching', () => {
      this.addStandardSpeaker();
      this.addTVSpeaker();
    });
  }

  // --- 1. ZWYKŁY GŁOŚNIK (Service.Speaker + Volume) ---
  addStandardSpeaker() {
    const uuid = this.api.hap.uuid.generate("test-standard-speaker");
    const accessory = new this.api.platformAccessory("Testowy Głośnik", uuid);

    let currentVolume = 20;
    let isMuted = false;

    const speakerService = accessory.addService(Service.Speaker, "Głośnik Zwykły");

    // Dodanie cechy Mute
    speakerService.getCharacteristic(Characteristic.Mute)
      .onGet(() => isMuted)
      .onSet((value) => {
        isMuted = value;
        this.log.info(`[Głośnik Zwykły] Mute: ${isMuted}`);
      });

    // Dodanie dodatkowej cechy Volume (widocznej w Eve / do scen w App Dom)
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
    const accessory = new this.api.platformAccessory("Testowy TV Głośnik", uuid);

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

    // Określamy typ kontroli jako ABSOLUTE (0-100%)
    tvSpeakerService.setCharacteristic(
      Characteristic.VolumeControlType,
      Characteristic.VolumeControlType.ABSOLUTE
    );

    // Mute
    tvSpeakerService.getCharacteristic(Characteristic.Mute)
      .onGet(() => tvMuted)
      .onSet((value) => {
        tvMuted = value;
        this.log.info(`[Głośnik TV] Mute: ${tvMuted}`);
      });

    // Volume (aktywne m.in. dla automatyzacji i aplikacji firm trzecich)
    tvSpeakerService.addCharacteristic(Characteristic.Volume)
      .onGet(() => tvVolume)
      .onSet((value) => {
        tvVolume = value;
        this.log.info(`[Głośnik TV] Ustawiono głośność: ${tvVolume}%`);
      });

    // Obsługa bocznych przycisków głośności z pilota iOS (VolumeSelector)
    tvSpeakerService.getCharacteristic(Characteristic.VolumeSelector)
      .onSet((value) => {
        const step = 5; // krok głośności przy kliknięciu przycisku +/-
        if (value === Characteristic.VolumeSelector.INCREMENT) {
          tvVolume = Math.min(100, tvVolume + step);
        } else if (value === Characteristic.VolumeSelector.DECREMENT) {
          tvVolume = Math.max(0, tvVolume - step);
        }
        this.log.info(`[Głośnik TV] Przycisk fizyczny (+/-) wywołany. Nowa głośność: ${tvVolume}%`);
      });

    // Powiązanie usługi Speaker z usługą TV
    tvService.addLinkedService(tvSpeakerService);

    this.api.registerPlatformAccessories("homebridge-test-speakers", "TestSpeakersPlatform", [accessory]);
    this.log.info("Zarejestrowano: TV Głośnik");
  }
}
