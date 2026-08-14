# TankAI Web v0.31.0 – typgesicherte CSV-Häufigkeitsverteilungen

TankAI Web erweitert `project.document.inspect` um begrenzte Häufigkeitsverteilungen. Nach den
vorhandenen Filtern können höchstens drei homogene Spalten ausgewertet werden. Jede Verteilung
liefert maximal zehn deterministisch geordnete Buckets.

Zahlen und Boolesche Werte werden typisiert zusammengeführt. Text-, Datums- und Zeitwerte werden
normalisiert verglichen; leere Zellen bilden einen expliziten Null-Bucket. Gemischte Spalten,
doppelte Anforderungen und überlange Anzeigewerte werden vor der Ausgabe abgewiesen.

`distinctValues`, `returnedBuckets`, `truncatedBuckets`, `returnedRows` und `otherRows` trennen
den vollständigen Ausführungsstand von der begrenzten Ausgabe. Gruppierte Aggregationen und
Häufigkeitsverteilungen müssen getrennt abgefragt werden, damit das 40.000-Byte-Ausgabebudget auch
am Richtlinienmaximum eingehalten wird.

Die Funktion verändert keine gespeicherten Daten, führt weder Tabellenformeln noch Code aus und
setzt `factsVerified` weiterhin ausdrücklich auf `false`.
