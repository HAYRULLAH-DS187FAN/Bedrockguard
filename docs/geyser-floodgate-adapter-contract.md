# Geyser/Floodgate Platform Adaptörü Sözleşmesi

Bu sözleşme, Java/proxy/Geyser tarafında çalışan küçük bir adaptörün BedrockGuard Bridge'e **şemalı platform profili** göndermesi içindir. BDS davranış paketi Floodgate kimliğini kendisi çözmeye çalışmaz; Geyser/Floodgate bağlamının bulunduğu katman bu işi yapar. Geyser ve Floodgate API'lerinin bağlantı/oyuncu sorgulama imkânları resmi belgelerde açıklanır.[1][2]

| Koşul | `clientFamily` | `source` | Güven yaklaşımı |
|---|---|---|---|
| Floodgate oyuncusu doğrulandı | `bedrock_geyser` | `floodgate` | Yüksek; adaptörün güncel oturum eşleşmesiyle verilir. |
| Geyser bağlantısı doğrulandı, Floodgate verisi yok | `bedrock_geyser` | `geyser` | Orta; kimlik sağlayıcısı belirtilmez. |
| Doğrudan BDS/Bedrock kaynağı biliniyor | `bedrock_direct` | `bds` veya `agent` | Kaynağın doğrulayabildiği ölçüde. |
| Java oyuncusu doğrulandı | `java` | `agent` | Kimlik kaynağına bağlı. |
| Eşleşme yok veya çelişki var | `unknown` | ilgili kaynak | `confidence: 0`; tüm hareket adayları bastırılır. |

> Adaptör, cihaz modeli, IP adresi, tam pozisyon izi veya ham Java/Bedrock paketi göndermez. `sessionId` gerekiyorsa kısa ömürlü, geri döndürülemez bir oturum referansı olmalıdır.

## İllüstratif Java/proxy akışı

```java
UUID uuid = player.getUniqueId();
boolean floodgate = FloodgateApi.getInstance().isFloodgatePlayer(uuid);

PlatformProfile profile = floodgate
  ? PlatformProfile.geyserBedrock("floodgate", 0.94)
  : PlatformProfile.unknown("agent");

bridge.publishPlayerProfile(uuid, player.getName(), profile);
```

Bu örnek yalnızca sözleşmeyi gösterir. Dağıtım, Geyser/Floodgate sürümüne ve proxy topolojinize göre derlenmeli; özellikle backend proxy kurulumlarında Floodgate veri iletimi doğrulanmalıdır.[2]

## Bridge'e gönderilecek NDJSON

```json
{"eventId":"7ad4d8f0-0000-4000-8000-000000000001","occurredAt":1787517600000,"type":"movement","player":{"uuid":"floodgate-player-uuid","name":"ExampleBedrock"},"platform":{"clientFamily":"bedrock_geyser","confidence":0.94,"identityProvider":"floodgate","proxyPath":"geyser_velocity","source":"floodgate"},"shadowObservation":{"candidateType":"speed","observedValue":21.2,"expectedMax":16,"sampleWindowMs":1200,"sampleCount":12,"measurementSource":"geyser_translated","environmentFlags":[],"serverEffects":[],"networkQuality":"stable"}}
```

Bridge, `platform` ve `shadowObservation` alanlarını imzalı Agent isteğine aynen taşır. Sunucu şemayı doğrular, platform profilini günceller ve hareket olayını **yalnızca gölge gözlemi** olarak kaydeder. Geçersiz enum, aşırı uzun alan veya şema dışı aday reddedilir.

## Kaynaklar

[1] [Geyser API başlangıç rehberi](https://wiki.geysermc.org/geyser/api/)

[2] [Floodgate API rehberi](https://wiki.geysermc.org/floodgate/api/)
