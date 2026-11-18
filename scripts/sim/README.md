# Phone simulator

Plays real games of Fake Tasker against the local Firebase emulators. Six phone-sized browsers each sign in as their own player, and the script locks, stalls, reloads and swaps their browsers at the worst moments. After each step it checks that every phone lands on the screen the server says it should be on.

```sh
npm run sim                                   # build the sim bundle, then run every scenario
npm run sim:build                             # just rebuild build-sim/ after a code change
SIM_ONLY="meeting,exile" npx firebase --project demo-fake-tasker \
  emulators:exec --only firestore,auth "node scripts/sim/run.mjs"   # run the scenarios whose names match
SIM_HEADED=1 …                                # watch the browsers
```

- **Votes last 20 seconds in the sim build.** Set by `REACT_APP_VOTE_DURATION_MS`; the real build still uses 3 minutes.
- **The sim uses the `demo-fake-tasker` project.** Nothing touches the live database.
- **Ports:** Firestore runs on 8080 and Auth on 9199. The app is served on 3100.
- **Failures** leave a screenshot and the console log of every phone in `sim-results/`.

Locking a phone hides the page, freezes its JavaScript and cuts its network. A `stall` instead leaves requests hanging with no error, which is how iOS loses a connection. A `discarded` wake reopens the tab from scratch, the way iOS does after evicting it.
