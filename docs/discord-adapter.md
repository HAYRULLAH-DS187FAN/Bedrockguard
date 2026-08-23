# Discord Oyuncu Sorgu Adaptörü

BedrockGuard, webhook ile olay bildirimi gönderir. Discord slash command veya component etkileşimlerini dinlemek, Discord uygulamasının imza doğrulamasını yaparak bu kontrol katmanına güvenli erişim sağlayacak ayrı bir bot adaptörünün sorumluluğundadır.

## Önerilen Akış

| Adım | Sorumluluk |
|---|---|
| 1 | Discord uygulaması gelen etkileşimin imzasını Discord’un resmî yöntemiyle doğrular. |
| 2 | Bot, çağıran kullanıcının yönetici rolünü kendi guild/role eşlemesinden kontrol eder. |
| 3 | Bot, yalnızca kendi servis hesabıyla BedrockGuard yönetici API katmanına bağlanır. |
| 4 | `serverId` ve oyuncu UUID’si ile oyuncu özetini, risk puanını ve son yaptırımları sorgular. |
| 5 | Yanıt yalnızca çağıran yöneticinin görebileceği ephemeral mesaj olarak gönderilir. |

Bot adaptörü hiçbir zaman Agent sırrı, webhook URL’si, ham imza, LLM yapılandırması veya tam sohbet geçmişini Discord yanıtında göstermemelidir. Oyuncu sorgusu için aşağıdaki daraltılmış çıktı biçimi önerilir:

```json
{
  "playerName": "Alex",
  "riskScore": 42,
  "status": "watch",
  "recentSignals": ["spam"],
  "pendingSanctions": 0
}
```

Bu MVP’de Discord botunun tokeni veya public key’i istenmemiştir; bu nedenle bot çalışma zamanı başlatılmaz. Webhook bildirimi yapılandırılabilir ve hata yalıtımlı biçimde hazırdır.
