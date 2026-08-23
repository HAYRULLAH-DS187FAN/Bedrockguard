# BedrockGuard Bridge Agent

Bu hafif Node.js köprüsü, BDS olay adaptöründen aldığı satır-sonlandırmalı JSON olaylarını BedrockGuard kontrol katmanına **HMAC-SHA-256 imzalı HTTPS istekleriyle** gönderir. Her BDS sunucusu için panelden üretilmiş ayrı `agentKeyId` ve tek-seferlik gösterilen `agentSecret` kullanılır.

Köprüyü çalıştırmak için `config.example.json` dosyasını `config.json` olarak kopyalayın, değerleri panelden alın ve aşağıdaki komutu BDS olay akışınıza bağlayın.

```bash
node bedrockguard-agent.mjs config.json < events.ndjson
```

Her olay bir JSON satırıdır. Örneğin:

```json
{"type":"chat","player":{"uuid":"player-xuid-or-uuid","name":"Alex"},"content":"Merhaba dünya"}
```

Köprü, olası yaptırım komutlarını standart çıkışına yine JSON satırları olarak yazar. BDS komut adaptörünüz bu çıktıyı yalnızca güvenilir bir yerel süreçte okuyup BDS konsoluna veya Script API `runCommandAsync` çağrısına iletmelidir. `commandId` için uygulama sonucunu `/api/agent/commands/ack` yoluna imzalı olarak iletmeniz gerekir.

> Köprü, kimlik bilgilerini hiçbir zaman günlüklemez. Hata çıktıları yalnızca HTTP kodu ve genel hata metnini içerir.
