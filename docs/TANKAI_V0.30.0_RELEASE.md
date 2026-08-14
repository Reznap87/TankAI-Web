# TankAI Web v0.30.0 – begrenzte gruppierte CSV-Aggregationen

TankAI Web erweitert die bestehende CSV-Dokumentabfrage um echte gruppierte Aggregationen.
Nach den vorhandenen Filtern können höchstens zwei Spalten als Gruppenschlüssel dienen. Je Gruppe
werden Summe, Minimum, Maximum und Mittelwert mit denselben Typ- und Zahlenbereichsregeln wie in
v0.29.0 berechnet.

Die Ausgabe ist auf acht deterministisch geordnete Gruppen begrenzt. `totalGroups`,
`returnedGroups` und `truncatedGroups` unterscheiden vollständige Datenmenge, tatsächlich
ausgegebene Gruppen und den begrenzten Rest. Überlange Schlüssel, doppelte Gruppenspalten und
Gruppierungen ohne Aggregation werden vor der Ausführung abgewiesen.

Die Änderung ist rein lesend. Sie führt keine Tabellenformeln oder sonstigen ausführbaren Inhalte
aus, verändert keine gespeicherten Daten und setzt `factsVerified` weiterhin ausdrücklich auf
`false`.
