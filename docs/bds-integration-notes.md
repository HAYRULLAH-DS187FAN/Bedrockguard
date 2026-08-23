# BDS Entegrasyon Notları

BedrockGuard Agent’ın birincil entegrasyon yüzeyi, BDS içindeki Script API davranış paketi olacaktır. Resmî olay modeli; sohbet gönderimi, oyuncu ve dünya olayları için abonelik destekler. `before` olay dinleyicileri oyun durumunu değiştiremez; bu nedenle Agent yalnızca hafif veri toplar, normalleştirir ve güvenli API’ye teslim eder. Yaptırım uygulama veya mesaj engelleme işlemleri, Engine kararından sonra BDS tarafında ayrı ve zamanlanmış bir komut/uygulama adaptörüyle gerçekleştirilmelidir.

`@minecraft/server-net`, BDS’ye özgü HTTP istekleri için kullanılabilir ancak deneysel durumdadır. Bu MVP, bu katmanı bir adaptör olarak soyutlar: desteklenen sürümlerde doğrudan Script API HTTP istemcisi; diğer sürümlerde BDS günlükleri/RCON veya sunucu eklentisi yanında çalışan köprü uygulaması kullanılabilir. Her iki yol, aynı imzalı `POST /api/agent/events` sözleşmesini kullanır.

Resmî `HttpRequest` örneği, `HttpRequest`, `HttpHeader`, `HttpRequestMethod` ve `http.request()` kullanılarak JSON gövdeli POST isteği oluşturulduğunu gösterir. Agent örneği bu yüzeyi; URL, JSON gövdesi, zaman aşımı ve `X-BedrockGuard-*` imza başlıklarını eklemek için kullanacaktır. Dış istekler üretimde TLS ile yapılmalıdır.

Kaynaklar: Microsoft Learn, [Working With Events](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/events?view=minecraft-bedrock-stable); Microsoft Learn, [@minecraft/server-net Module](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-net/minecraft-server-net?view=minecraft-bedrock-experimental).
