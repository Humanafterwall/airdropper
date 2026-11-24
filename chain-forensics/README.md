# chain-forensics

Jezgro (logika) aplikacije za istraživanje kripto adresa za potrebe policije i tužilaštva.
Nezavisno je od platforme: isti TypeScript kod mogu koristiti server, Windows klijent
(Electron/Tauri) i Android klijent (React Native). Jedina zavisnost je `@noble/hashes`,
čista JS kriptografija bez native modula.

```bash
npm install
npm test          # 45 testova, bez mreže
npm run typecheck
npm run build     # → dist/
```

## Šta jezgro radi

| Modul | Fajl | Opis |
|---|---|---|
| Model podataka | `src/model.ts` | Jedinstven `Transfer` za sve mreže; iznosi su `bigint` u najmanjoj jedinici (sat, wei) |
| Adapteri | `src/adapters/` | Bitcoin preko Esplora API-ja (mempool.space, Blockstream ili sopstveni electrs); EVM preko Etherscan v2 (Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche) |
| Validacija adresa | `src/util/address.ts` | Bitcoin base58check, bech32/bech32m (P2PKH, P2SH, P2WPKH, P2WSH, P2TR); EVM EIP-55 |
| Praćenje sredstava | `src/tracer.ts` | BFS napred/nazad, sa ograničenjem hop-ova, broja adresa i minimalnog iznosa. Poštuje vremenski redosled (prati se samo novac koji je stvarno mogao proći) i staje kod menjačnica, miksera i bridge-ova |
| Heuristike (UTXO) | `src/heuristics/utxo.ts` | Klasterizacija po zajedničkim ulazima (common-input), uz isključenje CoinJoin transakcija; detekcija change izlaza sa navedenim razlozima |
| Oznake | `src/labels.ts` | Baza entiteta sa izvorom i pouzdanošću; uvoz adresa sa OFAC SDN liste |
| Rizik | `src/risk.ts` | Objašnjiv skor 0–100: svaki poen ima entitet, udaljenost (hop) i izvor |
| Revizija | `src/audit.ts` | Ulančani SHA-256 log, otporan na izmene; `caseId` i `actor` su obavezni za svaku radnju |
| HTTP | `src/http.ts` | Svaki zahtev se upisuje u log sa SHA-256 heša odgovora; API ključevi se maskiraju; rate-limit i retry |
| Izveštaj | `src/report.ts` | JSON izveštaj za spis predmeta, sa hešom i vezom ka audit logu |

## Primer

```ts
import {
  AuditLog, AdapterRegistry, EsploraBitcoinAdapter, EtherscanEvmAdapter, CHAINS,
  LabelStore, parseOfacSdnAddresses, traceFunds, assessRisk, buildCaseReport,
} from "chain-forensics";

const ctx = { caseId: "KT-123/2026", actor: "analiticar.petrovic", audit: new AuditLog({ sink: saveToDb }) };

const registry = new AdapterRegistry()
  .register(new EsploraBitcoinAdapter(ctx, { baseUrl: "https://electrs.interno/api" }))
  .register(new EtherscanEvmAdapter(ctx, { chain: CHAINS.ethereum, apiKey: process.env.ETHERSCAN_KEY! }));

const labels = new LabelStore(parseOfacSdnAddresses(ofacSdnText));

const trace = await traceFunds({ chain: "ethereum", address: "0x..." }, registry, labels, ctx, {
  direction: "forward",
  maxHops: 4,
});
const risk = assessRisk(trace);
const report = buildCaseReport({ caseId: ctx.caseId, actor: ctx.actor, trace, risk, audit: ctx.audit });
// trace.endpoints → menjačnice ka kojima ide zakonski zahtev za KYC podatke
```

## Principi važni za dokaznu vrednost

- **Proporcionalna atribucija nije činjenica.** Kod Bitcoin transakcija sa više ulaznih
  adresa iznos se deli proporcionalno, i takvi transferi su označeni `attribution: "proportional"`.
  U izveštaju moraju biti predstavljeni kao analitički model.
- **Heuristike nisu dokaz.** Svaki zaključak nosi razloge i pouzdanost.
- **Oznaka nije identitet osobe.** Identifikacija se dobija zakonskim zahtevom menjačnici.
- **Ponovljivost.** Heš svakog sirovog odgovora je u logu. Za ozbiljne predmete preporučuje
  se sopstveni node ili indexer umesto javnih API-ja.
- **Nepotpun trag.** Ako je trag presečen nekim ograničenjem, `incomplete: true` to
  eksplicitno kaže.

## Sledeći koraci

- Adapteri: Tron (USDT-TRC20), Litecoin/BCH/Dogecoin (isti Esplora/Blockbook format), Solana
- Cross-chain praćenje kroz bridge-ove (povezivanje depozita i isplate)
- Detekcija peel-chain obrazaca i address poisoning-a
- Trajna baza (SQLite/Postgres) za oznake, keš i audit log
- Server API (REST) koji koriste Windows i Android klijenti
