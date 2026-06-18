# AntrophAI prototype rules — v0.41.83

## Round profile

Current primary profile: Godlike Warfare / GLW.

The static launcher also exposes a browser-local Intro Game slot alongside GLW. Tester access remains remembered locally in this browser only until a future server-side token ledger exists.

- 4x game speed
- no explore in GLW
- full revive system
- late-war seed available from launcher

## GLW late-war player baseline

- 35,000 land target profile with 1,500 unused/free land
- 20,000 banks
- 5,000 factories
- 4,000 barracks
- 4,500 science labs
- zero army

## Revives

- Revives are post-battle casualty return.
- Full revive rounds use army power per land.
- Ideal revive point is around 1,000 power per land.
- Race-advantage caps apply to the central revive plateau.
- Combat science is not part of the current revive model.

## Missiles

- 1 missile capacity per 20 missile bases.
- Missile capacity caps at 200 missiles / 4,000 effective missile bases.
- One launch costs 10,000 energy.
- Players under 500k power cannot be targeted by missiles.
- Blast Shields absorb missile damage first.
- Star Wars buildings intercept missiles using the Star Wars / land curve.

## Star Wars interception

Interception is calculated from Star Wars buildings as a percentage of target land.

Current curve:

- 0% land = 0% interception
- 0.2% land = 10% interception
- 1% land = 20% interception
- 5% land = 99% interception

The UI should describe this as an interception rate, not a per-missile chance.

## LRC

- LRC requires 1,000,000,000 Cardisium and 25,000 of each LRC mineral.
- LRC construction time is 48 hours at 1x, scaled by game speed.
- LRC shots = 10 + 1 per player in the firing alliance.
- First shot fires immediately at t=0.
- Later shots fire 1 Intro Game hour apart, i.e. 2 ticks apart.
- In GLW 4x this is 15 real minutes between shots.
- Firing at an alliance randomly selects a member of the target alliance for each shot.
- Individual LRC targets must be players who are not in an alliance.
- Each LRC shot creates a News item with target and power lost, but no building details.
- A personal popup/message is created only if that shot hits the player directly.
- Leaving/disbanding alliance is blocked while the alliance is firing or being fired upon, then cleared when the sequence finishes.
- Impact Shields reduce LRC damage using the Star Wars-style land curve, capped at 90% damage reduction.

## Scanners

Scanners and spies are separate mechanics.

- Scanners affect explore return rates.
- Scanners are not consumed by use.
- Current placeholder scanner curve uses scanner count as a percentage of land and caps at 10x explore return.
- GLW has explore disabled, but this global rule is present for other/future round profiles.

Current placeholder curve:

- 0% scanners/land = 1.00x
- 0.2% scanners/land = 1.90x
- 1% scanners/land = 3.25x
- 5% scanners/land = 7.75x
- 10% scanners/land = 10.00x cap

## Spies

Spies are deliberately deferred. Do not implement a guessed spy mechanic until old players provide reliable input.
