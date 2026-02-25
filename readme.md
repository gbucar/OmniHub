# OmniHub

## Minimalne zahteve
- dodanjanje sodelujočih
- dodajanje senzorjev
- povezava senzorjev s sodelujočimi
- prikaz sodelujočih in senzorjev
- prikaz podatkov po sodelujočih
- shranjevanje surovih podatkov iz senzorjev
- shranjevanje strukturiranih podatkov iz senzorjev

## Infrastruktura
![structure](https://www.plantuml.com/plantuml/svg/TLJDRjj64BxlKmnoYGtOyC6teYWYXKsgj6WKKqQ1j3uCjMDfoUKEiRkaKHLvX3v4NwIdvhswin95IMW9mwRd-_RZ_7mxRq947_lMAXLDj0HBrfuhXu1-Qo8riVS8mOH8BS8k_LJ6ewi9EjOO6nwKUWsp9fAlZS9rP0-l7d1dGeBGqleLO82PReqRqP8rsRxcV_uq6NmCv9NgSDtWXk3LvzubVGE3yGd_Gq5wVft5bcDV4SoMYoSv9843PFp6epRauXun_htwSYAuF2Jg3Anfu87rfBlaWNQIg2CWnv6onC9jA4JscIDHy6QpZS3Fvv0yjoaKoOi40uU1llvDWpJeXF4BLLlc1hZIP7704sZbqOLdzYskJOrJKmKbf_FNpwhvmMDRuLY0f9B3vJtSmJjZ2SfzABUslC-i_2i9OuKXDoJ4ZQVoqq_mbYJvp2tcMNF_FBFLb6QrCYs5DLegvfcqAYyfMUtzeinm-flnBsSffvb1i5nFNPS47hulLxdRouTpTcTD8zq8ZJaxjkQsOqSkfcexIr4yEdBnDtTL3cGZ_MZY3QpGs1VZz0qKQCBlZulhlGsxRgmnf-5fOqaVc_uqGPz7bwDhA9u02pSEYu3Xwr-nrwOsJuUgB_FCleS2mxPYz5gIcFuxJUMnypZOEd-oxzXZvSnvHeNScfg6J0daTknhEYNC75gpmukCfoeTTjWy_STuFdhMDK8-AX9ydDEdDCyy8ddPXuevuK0-Hm_l8lOQLjmS6mbN1KQ4TvPVhfNSLBYz_UvuTU0Rw3mv3fFRvSx-3-SENlQtHwaHpCpoFd72rgCxDgNtF9Yj69qZDIenBYIhp9PAXyu46A327P_B5dEHZRwNnISUo5IbKlnRmPSF2SSXSejH32ek1itfVATK0eKaFaki3-N7dsLV7SFJv2TGMbVau-Pqy4gM8anQUyZM25TvldG3ddQzZHZDjL9xdrr-ez-RQbpV4olFCn4STHmyQOVGUKd2XsPq0KxqST2d9nZwoRBIHr9AL5Ebcb_Ss4dPCNTmM17GoRQL_JSAdfC_5FEtS2Td9gPwGqxthVqN)

## Admin dashboard
### Upravljanje uporabnikov
- seznam uporabnikov z iskanjem, filtriranjem in paginacijo
- upravljanje vlog in pravic (npr. admin, raziskovalec, operator)
- ustvarjanje, urejanje in deaktivacija uporabnikov
- ponastavitev gesel in upravljanje dostopa (API ključi, 2FA)
- dodeljevanje in odvzem senzorjev uporabnikom ali skupinam
- uvoz/izvoz uporabnikov in bulk operacije
- revizijska zgodovina (audit log) in sledenje sprememb
- pregled napak in obvestila (npr. neuspešna povezava senzorjev; neizpolnjene ankete; senzor ne pošilja podatkov)

### Upravljanje senzorjev
- celovit pregled vseh senzorjev z iskanjem in filtriranjem
- dodajanje novih senzorjev in razvrščanje po tipu/locaciji
- urejanje nastavitev senzorjev (ime, status, metapodatki)
- spremljanje stanja in aktivnosti senzorjev (zadnji prejeti podatki, uptime)
- vizualizacija surovih in agregiranih podatkov za posamezni senzor
- nastavitve obvestil in pragov (alerti ob izpadu ali anomalii)
- skupinske operacije (bulk registracija, posodabljanje metapodatkov)

## Uporabniška aplikacija
### Pregled informacij o študiji
- uvodna stran z dobrodošlico in kratkim povzetkom ciljev študije
- pogoji sodelovanja, privolitev (consent) in kontaktne informacije za raziskovalce
- urnik, pomembni roki in navodila za sodelovanje
- ključne informacije o zasebnosti in kako so podatki obdelani

### Izpolnjevanje anket
- dinamične ankete, ki se prilagajajo odgovorom uporabnika
- možnost začasnega shranjevanja, dela v offline načinu in kasnejše sinhronizacije
- pregled stanja (kaj je izpolnjeno) in zgodovina odgovorov
- enostaven vmesnik za hitro izpolnjevanje na mobilnih napravah

### Pregled podatkov
- osebni nadzorni panel z agregiranimi in vizualnimi prikazi (grafi, trendi)
- pojasnila izmerjenih vrednostim
- možnost izvozov

### Povezovanje in podpora
- vodnik za povezavo senzorjev (pairing), diagnostika in status naprav
- pomoč: FAQ, kontaktna točka in sistem za prijavo težav

## Shema podatkov
### Obstoječi standardi
tukaj so naštete obstoječe sheme, ki bi jih lahko uporabili (tako v bazi podatkov kot tudi v REST API-ju)
- [OGC](https://www.ogc.org/standards/)
	- [OGC SensorThings API](https://developers.sensorup.com/docs/#introduction)
		- [shema](https://docs.ogc.org/is/18-088/18-088.html#sensing-entities2)
		- v tej shemi se da shranjevati podatke iz senzorjev za več sodelujočih, to vključuje tudi recimo odgovore na anketo
- [Smart Data Models](https://github.com/smart-data-models/)
	- bolj za IoT, vseeno bi se lahko podalo API tudi v tej shemi
- [SAREF](https://saref.etsi.org/)
	- [core](https://saref.etsi.org/core/v4.1.1/)
	- mogoče malo bolj kompleksna? ne vidim plusa te sheme pred [OGC SensorThings API](https://developers.sensorup.com/docs/#introduction)

## Uporabni linki
- [hyperUI](https://www.hyperui.dev/components/application/range-inputs)
