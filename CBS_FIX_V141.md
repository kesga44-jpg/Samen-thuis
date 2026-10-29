# CBS brandstofdata fix v1.4.1

De CBS-koppeling kiest nu expliciet de hoogste geldige `Perioden`-code uit tabel 80416NED.
Daardoor wordt niet langer per ongeluk 20060101 als eerste/oude rij getoond.

De kaart blijft een landelijke CBS-referentie. Voor actuele prijzen per individueel tankstation
is een aparte live-prijsbron nodig.
