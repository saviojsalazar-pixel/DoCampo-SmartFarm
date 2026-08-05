(function(){'use strict';
  window.DoCampoHerbicideDefaults = {
            "Pós-emergente - Não Seletivos": [
                { name: "RoundUp Ultra-SL-Bayer", dose: 2.50, unit: "L/ha", target: "Dessecação Geral / Gramíneas e Latifoliadas", active: "Glifosato (Sal de Amônio)" },
                { name: "Glyphosate 480-SL-Nortox", dose: 3.00, unit: "L/ha", target: "Dessecação Geral / Ervas Gerais", active: "Glifosato (Sal Isopropilamina)" },
                { name: "Glifosato 480-SL-ALAMOS", dose: 2.00, unit: "L/ha", target: "Capim-favorito", active: "Glifosato" },
                { name: "Roundup Original-SL-Bayer", dose: 2.00, unit: "L/ha", target: "Picão-preto", active: "Glifosato" },
                { name: "Roundup Transorb-SL-Bayer", dose: 2.00, unit: "L/ha", target: "Picão-preto", active: "Glifosato" },
                { name: "Xeque Mate-WG-Ihara", dose: 1.00, unit: "kg/ha", target: "Picão-preto", active: "Glifosato (Sal de Potássio)" },
                { name: "Finale-SL-BASF", dose: 2.00, unit: "L/ha", target: "Picão-preto / Buva / Trapoeraba", active: "Glufosinato (Sal de Amônio)" },
                { name: "Audace-SL-Alta", dose: 2.00, unit: "L/ha", target: "Picão-preto", active: "Glufosinato (Sal de Amônio)" }
            ],
            "Pós-emergente - Folha Larga (Latifoliada)": [
                { name: "Heat-WG-BASF", dose: 0.05, unit: "kg/ha", target: "Buva resistente / Corda-de-viola / Trapoeraba", active: "Saflufenacil" },
                { name: "Reglone-SL-Syngenta", dose: 2.00, unit: "L/ha", target: "Dessecação de Contato", active: "Diquat" },
                { name: "Aurora-EC-FMC", dose: 0.10, unit: "L/ha", target: "Trapoeraba", active: "Carfentrazona-etílica" },
                { name: "Clorimuron-WG-Prentiss", dose: 80.00, unit: "g/ha", target: "Trapoeraba", active: "Clorimuron-etílico" },
                { name: "Ally-WG-FMC", dose: 10.00, unit: "g/ha", target: "Trapoeraba / Picão-preto", active: "Metsulfuron-metílico" },
                { name: "Zartan-WG-UPL", dose: 10.00, unit: "g/ha", target: "Picão-preto", active: "Metsulfuron-metílico" },
                { name: "Mtsuram 600-WG-Albaugh", dose: 10.00, unit: "g/ha", target: "Picão-preto", active: "Metsulfuron-metílico" },
                { name: "Metsulfuron-WG-Nortox", dose: 10.00, unit: "g/ha", target: "Picão-preto", active: "Metsulfuron-metílico" },
                { name: "2,4-D Nortox-SL-Nortox", dose: 1.20, unit: "L/ha", target: "Trapoeraba / Corda-de-viola / Picão-preto", active: "2,4-D (Sal Dimetilamina)" },
                { name: "Classic-WG-Corteva", dose: 0.08, unit: "kg/ha", target: "Corda-de-viola / Poaia", active: "Clorimuron-etílico" }
            ],
            "Pós-emergente - Folha Estreita (Gramíneas)": [
                { name: "Cartago-EC-Alta", dose: 1.00, unit: "L/ha", target: "Capim-amargoso", active: "Cletodim" },
                { name: "Select-EC-UPL", dose: 1.00, unit: "L/ha", target: "Capim-amargoso", active: "Cletodim" },
                { name: "Freno-EC-Albaugh", dose: 1.00, unit: "L/ha", target: "Capim-amargoso", active: "Cletodim" },
                { name: "Poquer-EC-Adama", dose: 1.00, unit: "L/ha", target: "Capim-amargoso", active: "Cletodim" },
                { name: "Grasidim Plus-EC-Rainbow", dose: 0.80, unit: "L/ha", target: "Capim-amargoso", active: "Cletodim; Haloxifope-P-metílico" },
                { name: "Verdict Max-EC-CTVA", dose: 0.30, unit: "L/ha", target: "Capim-amargoso", active: "Haloxifope-P-metílico" },
                { name: "Verdict Ultra-EC-CTVA", dose: 0.17, unit: "L/ha", target: "Capim-amargoso", active: "Haloxifope-P-metílico" },
                { name: "Targa Max-EC-Ihara", dose: 1.00, unit: "L/ha", target: "Capim-amargoso", active: "Quizalofope-P-etílico" }
            ],
            "Pré-emergente - Não Seletivo": [
                { name: "Alion-SC-Bayer", dose: 0.15, unit: "L/ha", target: "Trapoeraba / Gramíneas e Latifoliadas", active: "Indaziflam" },
                { name: "Yamato-SC-Ihara", dose: 0.40, unit: "L/ha", target: "Capim-amargoso", active: "Piroxasulfona" },
                { name: "Dual Gold-EC-Syngenta", dose: 2.00, unit: "L/ha", target: "Brachiaria decumbens / Capim-pé-de-galinha", active: "S-Metolacloro" },
                { name: "Goal BR-EC-Proventis", dose: 3.00, unit: "L/ha", target: "Picão-preto", active: "Oxyfluorfen" },
                { name: "Boral 500 SC-FMC", dose: 0.80, unit: "L/ha", target: "Tiririca / Guanxuma / Corda-de-viola", active: "Sulfentrazone" }
            ],
            "Pré e Pós-Emergente - Não Seletivo": [
                { name: "Flumyzin 500-SC-Sumitomo", dose: 0.18, unit: "L/ha", target: "Picão-preto", active: "Flumioxazina" },
                { name: "Falcon-SC-Ihara", dose: 0.60, unit: "L/ha", target: "Trapoeraba", active: "Piroxasulfona; Flumioxazina" }
            ],
            "Adjuvantes / Antideriva / Corretores": [
                { name: "Adjuvante Genérico", dose: 0.10, unit: "L/ha", target: "Espalhante / Adjuvante (0,05% v/v)", active: "Cálculo em função do volume de calda (0,05% do volume de calda)" },
                { name: "Óleo Mineral/Vegetal Genérico", dose: 0.50, unit: "L/ha", target: "Óleo Mineral/Vegetal (0,25% v/v)", active: "Cálculo em função do volume de calda (0,25% do volume de calda)" },
                { name: "Silwet L-77-AG-Momentive", dose: 0.05, unit: "L/ha", target: "Espalhante Siliconado Organosiliconado", active: "Poliéter Polimetilsiloxano" },
                { name: "Assist-EC-BASF", dose: 0.50, unit: "L/ha", target: "Óleo Mineral Emulsionável", active: "Óleo Mineral 756 g/L" },
                { name: "Aureo-EC-Bayer", dose: 0.50, unit: "L/ha", target: "Óleo Vegetal / Redutor de Deriva", active: "Éster Metílico de Óleo de Soja" },
                { name: "TA30 Antideriva-SL-Arysta", dose: 0.10, unit: "L/ha", target: "Redutor de Deriva e Antiespumante", active: "Surfactantes Não Iônicos" },
                { name: "Redusim pH-SL-Iharabras", dose: 0.15, unit: "L/ha", target: "Redutor de pH e Sequestrante de Cátions", active: "Ácido Cítrico + Tensoativos" }
            ]
        };
})();
