/* Samen Thuis v15.0
   - Bodemprijzen / goede-deal database
   - Gierige Gerda lijst 31-08-2026 als startdata
   - Nieuwere bodemprijzen-PDF direct importeerbaar
   - Prijsreferenties zichtbaar bij Boodschappen en Voorraad
   - Aanbevolen huishoudverdeling kan op bestaande taken worden toegepast
*/
console.info('Samen Thuis update 15.0 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V150__) return;
  window.__SAMEN_THUIS_V150__ = true;

  const baseRender15 = render;
  const DEFAULT_PRICES = [{"category":"(Fris)drank","product":"Aanmaaklimonade","brand":"Karvam Cevitan","quantity":"liter","floorPrice":3.33,"goodDealPrice":4.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Aanmaaklimonade","brand":"Raak","quantity":"liter","floorPrice":1.86,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Aanmaaklimonade","brand":"Teisseire","quantity":"liter","floorPrice":4.0,"goodDealPrice":4.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Cola","brand":"Coca-Cola","quantity":"liter","floorPrice":0.85,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Cola","brand":"huismerk","quantity":"liter","floorPrice":0.33,"goodDealPrice":0.6,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Cola","brand":"Pepsi","quantity":"liter","floorPrice":0.67,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Energiedrank","brand":"Red Bull","quantity":"250 ml","floorPrice":0.85,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Frisdrank overig","brand":"A-merk","quantity":"liter","floorPrice":1.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"IJsthee","brand":"Lipton","quantity":"liter","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Rivella","brand":"","quantity":"liter","floorPrice":0.83,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Chips","product":"Popcorn","brand":"Jimmy's","quantity":"100 gram","floorPrice":0.89,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Diepvries","product":"IJs","brand":"Ben & Jerry's","quantity":"500 ml","floorPrice":3.21,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Diepvries","product":"IJsstam","brand":"Viennetta","quantity":"600 gram","floorPrice":0.89,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Conditioner","brand":"A-merk","quantity":"300 ml","floorPrice":1.99,"goodDealPrice":3.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Conditioner","brand":"huismerk","quantity":"500 ml","floorPrice":1.0,"goodDealPrice":1.25,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Damesscheermesjes","brand":"A-merk","quantity":"stuk","floorPrice":1.67,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant roller","brand":"A-merk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant roller","brand":"huismerk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant spuitbus","brand":"A-merk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant spuitbus","brand":"huismerk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Douchegel","brand":"Fa","quantity":"250 ml","floorPrice":0.33,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Handzeep","brand":"A-merk","quantity":"liter","floorPrice":2.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Herenscheermesjes","brand":"A-merk","quantity":"stuk","floorPrice":1.92,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Opzetborstel elektrisch","brand":"A-merk","quantity":"stuk","floorPrice":1.79,"goodDealPrice":2.5,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Opzetborstel elektrisch","brand":"huismerk","quantity":"stuk","floorPrice":0.31,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Shampoo","brand":"A-merk","quantity":"300 ml","floorPrice":1.99,"goodDealPrice":3.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Shampoo","brand":"huismerk","quantity":"500 ml","floorPrice":1.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandenborstel","brand":"A-merk","quantity":"stuk","floorPrice":0.33,"goodDealPrice":0.5,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"A-merk (doosje)","quantity":"75 ml","floorPrice":1.0,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"A-merk (tube)","quantity":"75 ml","floorPrice":0.5,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"huismerk","quantity":"75 ml","floorPrice":0.25,"goodDealPrice":0.41,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"Parodontax","quantity":"75 ml","floorPrice":1.67,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Zonnebrandcrème","brand":"A-merk","quantity":"200 ml","floorPrice":5.99,"goodDealPrice":8.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Zonnebrandcrème","brand":"huismerk","quantity":"200 ml","floorPrice":3.2,"goodDealPrice":4.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Afwasmiddel","brand":"A-merk","quantity":"liter","floorPrice":2.85,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Allesreiniger","brand":"A-merk","quantity":"liter","floorPrice":0.9,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Allesreiniger","brand":"huismerk","quantity":"liter","floorPrice":0.75,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Allesreiniger doekjes","brand":"huismerk","quantity":"80 stuks","floorPrice":0.49,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Biotex","brand":"","quantity":"100 gram","floorPrice":0.42,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Keukenrol","brand":"2-laags","quantity":"100 vel","floorPrice":0.52,"goodDealPrice":0.75,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Keukenrol","brand":"3-laags","quantity":"100 vel","floorPrice":0.78,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Oxi vlekverwijderaar","brand":"A-merk","quantity":"kilo","floorPrice":6.47,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Toiletblok","brand":"A-merk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Toiletblok","brand":"huismerk","quantity":"stuk","floorPrice":0.5,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Toiletpapier","brand":"3-laags","quantity":"100 vel","floorPrice":0.13,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwaspoeder","brand":"A-merk","quantity":"wasbeurt","floorPrice":0.05,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwaspoeder","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwastablet","brand":"Dreft","quantity":"wasbeurt","floorPrice":0.17,"goodDealPrice":0.2,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwastablet","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.04,"goodDealPrice":0.08,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwastablet","brand":"Sun","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel","brand":"Neutral","quantity":"wasbeurt","floorPrice":0.19,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel pods","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.1,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel pods","brand":"Reus","quantity":"wasbeurt","floorPrice":0.14,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel poeder","brand":"Ariel","quantity":"wasbeurt","floorPrice":0.2,"goodDealPrice":0.23,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel poeder","brand":"Reus","quantity":"wasbeurt","floorPrice":0.14,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel quickwash","brand":"Robijn","quantity":"wasbeurt","floorPrice":0.22,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Ariel","quantity":"wasbeurt","floorPrice":0.2,"goodDealPrice":0.23,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Fleuril","quantity":"wasbeurt","floorPrice":0.13,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Omo","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":0.11,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Reus","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":0.11,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Robijn","quantity":"wasbeurt","floorPrice":0.13,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddeldoekje","brand":"A-merk","quantity":"wasbeurt","floorPrice":0.07,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddeldoekje","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.1,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasparfum","brand":"Robijn","quantity":"wasbeurt","floorPrice":0.16,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasverzachter","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.02,"goodDealPrice":0.05,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Zakdoekjes (4-laags)","brand":"huismerk","quantity":"pakje 10 zakdoekjes","floorPrice":0.07,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Filterkoffie","brand":"A-merk","quantity":"500 gram","floorPrice":5.29,"goodDealPrice":6.5,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Filterkoffie","brand":"huismerk","quantity":"500 gram","floorPrice":3.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiebonen","brand":"huismerk","quantity":"kilo","floorPrice":6.66,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiecup","brand":"A-merk","quantity":"stuk","floorPrice":0.25,"goodDealPrice":0.3,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiecup","brand":"huismerk","quantity":"stuk","floorPrice":0.09,"goodDealPrice":0.13,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiepads","brand":"A-merk","quantity":"per pad","floorPrice":0.07,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiepads","brand":"huismerk","quantity":"per pad","floorPrice":0.05,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Thee","brand":"A-merk","quantity":"doosje 20 stuks","floorPrice":1.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Thee","brand":"Clipper","quantity":"doosje 20 stuks","floorPrice":1.79,"goodDealPrice":1.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Olie","product":"Olijfolie extra vierge","brand":"A-merk","quantity":"liter","floorPrice":4.99,"goodDealPrice":7.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Duopasta","brand":"Duo Pennotti","quantity":"kilo","floorPrice":4.36,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Hazelnootpasta","brand":"A-merk","quantity":"kilo","floorPrice":5.3,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Hazelnootpasta","brand":"huismerk","quantity":"kilo","floorPrice":3.49,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Ontbijtgranen","brand":"A-merk","quantity":"kilo","floorPrice":6.5,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Pindakaas","brand":"A-merk","quantity":"kilo","floorPrice":3.06,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Pindakaas","brand":"huismerk","quantity":"kilo","floorPrice":2.54,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Pindakaas 100%","brand":"huismerk","quantity":"kilo","floorPrice":2.86,"goodDealPrice":3.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Farfalle","brand":"huismerk","quantity":"kilo","floorPrice":1.35,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Fusilli","brand":"huismerk","quantity":"kilo","floorPrice":1.39,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Macaroni","brand":"huismerk","quantity":"kilo","floorPrice":0.99,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Noodles","brand":"Indomie","quantity":"zakje","floorPrice":0.3,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Noodles","brand":"Unox","quantity":"pot","floorPrice":0.99,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Noodles","brand":"Unox","quantity":"zakje","floorPrice":0.58,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Penne","brand":"huismerk","quantity":"kilo","floorPrice":1.08,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst","brand":"Lassie","quantity":"kilo","floorPrice":1.74,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst basmati","brand":"huismerk","quantity":"kilo","floorPrice":1.79,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst pandan","brand":"huismerk","quantity":"kilo","floorPrice":1.79,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst zilvervlies","brand":"huismerk","quantity":"kilo","floorPrice":1.4,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Spaghetti","brand":"huismerk","quantity":"kilo","floorPrice":0.66,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Sauzen","product":"Mayonaise","brand":"A-merk","quantity":"liter","floorPrice":2.22,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Snoep","product":"Pepermunt","brand":"Wilhelmina","quantity":"per rol","floorPrice":0.29,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Vlees","product":"Rookworst","brand":"HEMA","quantity":"stuk","floorPrice":2.49,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Vlees","product":"Rookworst","brand":"huismerk","quantity":"stuk","floorPrice":0.99,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Wereldkeuken","product":"Pizza","brand":"Crosta & Mollica","quantity":"stuk","floorPrice":3.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Wereldkeuken","product":"Wereldgerechten burritos","brand":"Knorr","quantity":"pak 2-3 personen","floorPrice":1.0,"goodDealPrice":1.35,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Chocolademelk","brand":"A-merk","quantity":"liter","floorPrice":0.75,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Houdbare melk","brand":"A-merk","quantity":"liter","floorPrice":0.79,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Houdbare melk","brand":"huismerk","quantity":"liter","floorPrice":0.66,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Kaas (jong belegen)","brand":"huismerk","quantity":"kilo","floorPrice":5.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Roomboter","brand":"huismerk","quantity":"500 gram","floorPrice":2.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Smeerkaas","brand":"A-merk","quantity":"100 gram","floorPrice":0.75,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"}];
  const ASSIGNMENTS = {"Keuken en woonkamer dagelijkse reset":"Samen","WC schoonmaken":"Kees","Badkamer schoonmaken":"Daphne","Vloeren hele huis":"Kees","Afstoffen hele huis":"Daphne","Keuken grondig schoonmaken":"Daphne","Slaapkamer opruimen en schoonmaken":"Samen","Bureau- en wasruimte opruimen":"Kees","Hal opruimen en schoonmaken":"Kees","Koelkast weekcontrole":"Daphne","Spiegels en glazen oppervlakken reinigen":"Daphne","Deurklinken en lichtknoppen reinigen":"Samen","Onder bed, bank en meubels stofzuigen":"Kees","Afvalbakken reinigen":"Kees","Beddengoed verschonen":"Samen","Handdoeken en keukentextiel vervangen":"Samen","Kledingwas verwerken":"Samen","Badmat en schoonmaakdoeken wassen":"Daphne","Koelkast volledig schoonmaken":"Daphne","Oven en afzuigkap grondig reinigen":"Kees","Badkamer dieptereiniging":"Daphne","Plinten, deuren en kozijnen reinigen":"Samen","Radiatoren en ventilatieroosters reinigen":"Kees","Ramen binnenzijde en kozijnen schoonmaken":"Kees","Bank en hoge oppervlakken grondig reinigen":"Daphne","Wasmachine onderhouden":"Kees","Voorraadkast en keukenkastjes nalopen":"Daphne","Kledingkast en opbergkast nalopen":"Samen"};

  const norm15 = (v='') => String(v).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  const esc15 = (v='') => String(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const euro15 = n => Number.isFinite(Number(n))
    ? new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(n))
    : '—';

  data.priceReferences ||= [];
  if(!data.priceReferences.length) {
    data.priceReferences = DEFAULT_PRICES.map((x,i)=>({id:`price-${i+1}`,...x}));
    data.priceReferenceSource = 'Gierige Gerda Media 2026';
    data.priceReferenceUpdatedAt = '2026-08-31';
    save({touch:false});
  }

  let pricePreview15 = [];
  let priceFileName15 = '';

  function bestRefs15(title='') {
    const q=norm15(title);
    if(!q) return [];
    const exact=[], loose=[];
    for(const r of data.priceReferences||[]) {
      const p=norm15(r.product);
      if(!p) continue;
      if(q===p || q.includes(p) || p.includes(q)) exact.push(r);
      else {
        const words=p.split(' ').filter(w=>w.length>3);
        if(words.length && words.some(w=>q.includes(w))) loose.push(r);
      }
    }
    return (exact.length?exact:loose).sort((a,b)=>(a.floorPrice??999)-(b.floorPrice??999));
  }

  function priceBadge15(ref) {
    if(!ref) return '';
    return `<span class="tag green">Bodem ${euro15(ref.floorPrice)} / ${esc15(ref.quantity)}</span>`+
      (ref.goodDealPrice!=null?` <span class="tag">Goede deal ≤ ${euro15(ref.goodDealPrice)}</span>`:'');
  }

  function renderPriceReferenceCard15() {
    const items=current==='groceries'?(data.groceries||[]):(data.stock||[]);
    const matched=items.map(item=>({item,refs:bestRefs15(item.title||item.name||'')}))
      .filter(x=>x.refs.length);

    return `<section class="card" data-v15-price-card>
      <div class="card-head">
        <div>
          <p class="eyebrow">BODEMPRIJZEN</p>
          <h2>Prijsreferentie</h2>
        </div>
        <span class="tag green">${(data.priceReferences||[]).length} prijzen</span>
      </div>
      <p class="muted">Bron: ${esc15(data.priceReferenceSource||'Prijsreferenties')} · bijgewerkt ${esc15(data.priceReferenceUpdatedAt||'onbekend')}.</p>
      ${matched.length?`
        <div class="v13-preview-list">
          ${matched.slice(0,12).map(x=>`
            <article class="v13-card">
              <strong>${esc15(x.item.title||x.item.name)}</strong>
              <div style="margin-top:8px">${priceBadge15(x.refs[0])}</div>
              <small class="muted">${esc15(x.refs[0].brand||'')}${x.refs.length>1?` · ${x.refs.length} passende referenties`:''}</small>
            </article>`).join('')}
        </div>`:
        `<p class="muted">Er zijn nog geen producten op deze pagina die automatisch aan de bodemprijzenlijst gekoppeld zijn.</p>`}
    </section>`;
  }

  function injectPagePriceCard15() {
    if(!['groceries','stock'].includes(current)) return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v15-price-card]')) return;
    view.insertAdjacentHTML('afterbegin',renderPriceReferenceCard15());
  }

  function householdStats15() {
    const counts={Kees:0,Daphne:0,Samen:0};
    (data.chores||[]).forEach(x=>{ if(counts[x.person]!=null) counts[x.person]++; });
    return counts;
  }

  function injectHouseholdDistribution15() {
    if(current!=='chores') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v15-household]')) return;
    const c=householdStats15();
    view.insertAdjacentHTML('afterbegin',`
      <section class="card" data-v15-household>
        <div class="card-head">
          <div><p class="eyebrow">VERDELING</p><h2>Huishoudtaken</h2></div>
          <button class="secondary" data-v15-distribute>⚖️ Aanbevolen verdeling toepassen</button>
        </div>
        <p class="muted">Samen betekent: gezamenlijke verantwoordelijkheid; één van jullie mag de taak afronden.</p>
        <div class="button-row">
          <span class="tag">Kees · ${c.Kees}</span>
          <span class="tag">Daphne · ${c.Daphne}</span>
          <span class="tag">Samen · ${c.Samen}</span>
        </div>
      </section>`);
  }

  function applyHouseholdDistribution15() {
    let changed=0;
    (data.chores||[]).forEach(task=>{
      const key=Object.keys(ASSIGNMENTS).find(k=>norm15(k)===norm15(task.title));
      if(key && ASSIGNMENTS[key] && task.person!==ASSIGNMENTS[key]) {
        task.person=ASSIGNMENTS[key];
        changed++;
      }
    });
    save(); render(); toast(`${changed} huishoudtaken opnieuw verdeeld`);
  }

  function parsePrice15(value) {
    const m=String(value||'').match(/(\d+[,.]\d+|\d+)/);
    return m?Number(m[1].replace(',','.')):null;
  }

  const CATS15=['(Fris)drank','Chips','Diepvries','Drogisterij','Huishouden','Koffie en thee','Olie','Ontbijt en lunch','Pasta en rijst','Sauzen','Snoep','Vlees','Wereldkeuken','Zuivel'];

  function parsePricePdfText15(text='') {
    const lines=String(text).replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const updated=(String(text).match(/Update datum:\s*(\d{1,2})\s+([A-Za-zé]+)\s+(20\d{2})/i)||[]);
    const months={januari:'01',februari:'02',maart:'03',april:'04',mei:'05',juni:'06',juli:'07',augustus:'08',september:'09',oktober:'10',november:'11',december:'12'};
    const updateISO=updated.length?`${updated[3]}-${months[norm15(updated[2])]||'01'}-${String(updated[1]).padStart(2,'0')}`:'';

    const result=[];
    for(const line of lines) {
      if(/^Categorie\s+Product/i.test(line) || /Copyright Gierige Gerda/i.test(line)) continue;
      const category=CATS15.find(c=>line.startsWith(c+' '));
      if(!category) continue;
      const priceMatch=line.match(/€\s*(\d+[,.]\d+)\s*(?:€\s*(\d+[,.]\d+)|[-x])?\s*$/i);
      if(!priceMatch) continue;

      const prefix=line.slice(category.length,priceMatch.index).trim();
      const qtyRx=/(pakje\s+10\s+zakdoekjes|doosje\s+20\s+stuks|pak\s+2-3\s+personen|100\s+vel|80\s+stuks|600\s+gram|500\s+gram|300\s+ml|250\s+ml|200\s+ml|100\s+gram|75\s+ml|500\s+ml|kilo|liter|stuk|wasbeurt|per\s+pad|per\s+rol|zakje|pot)$/i;
      const qm=prefix.match(qtyRx);
      if(!qm) continue;
      const quantity=qm[1];
      const left=prefix.slice(0,qm.index).trim();

      let product='',brand='';
      const known=DEFAULT_PRICES.find(r=>norm15(`${r.product} ${r.brand}`)===norm15(left))
        || DEFAULT_PRICES.find(r=>norm15(left).startsWith(norm15(r.product)) && (!r.brand || norm15(left).includes(norm15(r.brand))));
      if(known) {
        product=known.product; brand=known.brand;
      } else {
        const tokens=left.split(/\s+/);
        brand=tokens.pop()||'';
        product=tokens.join(' ');
      }

      result.push({
        id:`price-import-${Date.now()}-${result.length}`,
        category,product,brand:brand==='-'?'':brand,quantity,
        floorPrice:parsePrice15(priceMatch[1]),
        goodDealPrice:parsePrice15(priceMatch[2]),
        source:'Gierige Gerda Media',
        updatedAt:updateISO
      });
    }
    return {items:result,updatedAt:updateISO};
  }

  function priceImportCard15() {
    return `<section class="card" data-v15-price-import>
      <div class="card-head">
        <div><p class="eyebrow">BODEMPRIJZEN</p><h2>Bodemprijzenlijst importeren</h2></div>
        <span class="tag green">${(data.priceReferences||[]).length} actief</span>
      </div>
      <p>Upload hier rechtstreeks de <strong>Gierige Gerda bodemprijzenlijst</strong>. De lijst wordt apart bewaard en niet als voorraadproduct.</p>
      <div class="form-grid">
        <div class="field full">
          <label>PDF / TXT</label>
          <input type="file" id="v15PriceFile" accept=".pdf,.txt,text/plain,application/pdf">
        </div>
      </div>
      ${priceFileName15?`<p class="muted">Bronbestand: <strong>${esc15(priceFileName15)}</strong></p>`:''}
      ${pricePreview15.length?`
        <div class="card-head" style="margin-top:16px">
          <div><strong>${pricePreview15.length} prijzen gevonden</strong><br><small class="muted">Controleer het aantal en vervang daarna de huidige prijsreferenties.</small></div>
          <button class="primary" data-v15-price-commit>Huidige lijst vervangen</button>
        </div>
        <div class="v13-preview-list">
          ${pricePreview15.slice(0,8).map(r=>`
            <article class="v13-card">
              <strong>${esc15(r.product)}</strong><br>
              <small>${esc15(r.brand||'Geen merk')} · ${esc15(r.quantity)}</small>
              <div style="margin-top:6px">${priceBadge15(r)}</div>
            </article>`).join('')}
        </div>
        ${pricePreview15.length>8?`<p class="muted">+ ${pricePreview15.length-8} overige prijzen</p>`:''}
      `:''}
    </section>`;
  }

  function injectPriceImport15() {
    if(current!=='imports') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v15-price-import]')) return;
    view.insertAdjacentHTML('afterbegin',priceImportCard15());
    bindPriceFile15();
  }

  function bindPriceFile15() {
    const input=document.querySelector('#v15PriceFile');
    if(!input || input.dataset.bound==='1') return;
    input.dataset.bound='1';
    input.addEventListener('change',async e=>{
      const file=e.target.files?.[0]; if(!file) return;
      try {
        priceFileName15=file.name;
        toast('Bodemprijzenlijst wordt gelezen…');
        const ext=file.name.toLowerCase().split('.').pop();
        const text=ext==='pdf'?await extractPdfText(file):await file.text();
        const parsed=parsePricePdfText15(text);
        pricePreview15=parsed.items;
        if(parsed.updatedAt) pricePreview15.forEach(x=>x.updatedAt=parsed.updatedAt);
        render();
        toast(`${pricePreview15.length} bodemprijzen gevonden`);
      } catch(err) {
        console.error(err);
        toast('Bodemprijzenlijst kon niet worden gelezen');
      }
    });
  }

  function commitPrices15() {
    if(!pricePreview15.length) return toast('Upload eerst een bodemprijzenlijst');
    data.priceReferences=pricePreview15.map(x=>({...x}));
    data.priceReferenceSource='Gierige Gerda Media';
    data.priceReferenceUpdatedAt=pricePreview15.find(x=>x.updatedAt)?.updatedAt || new Date().toISOString().slice(0,10);
    save();
    const n=pricePreview15.length;
    pricePreview15=[]; priceFileName15='';
    render(); toast(`${n} bodemprijzen opgeslagen`);
  }

  render=function renderV150() {
    baseRender15();
    injectPriceImport15();
    injectPagePriceCard15();
    injectHouseholdDistribution15();
  };

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v15-distribute]')) {
      e.preventDefault(); applyHouseholdDistribution15(); return;
    }
    if(e.target.closest('[data-v15-price-commit]')) {
      e.preventDefault(); commitPrices15(); return;
    }
  },true);

  save({touch:false});
  toast('Samen Thuis v15 geladen');
})();
