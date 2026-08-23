import React from 'react';

function HowToPlay() {
  return (
    <details className="how-to-play">
      <summary>How to play</summary>

      <div className="how-to-play-body">
        <section>
          <h4>The idea</h4>
          <p>
            Everyone is given real tasks to do around the house. Most of you are
            taskers actually doing them. One or more of you are traitors, only
            pretending, quietly taking taskers out of the game.
          </p>
        </section>

        <section>
          <h4>If you are a Tasker</h4>
          <p>
            Work through your task list and tap each one off as you finish it.
            The bar on your screen tracks the whole group, not just you.
            <strong> If everyone finishes their tasks, the taskers win.</strong>
          </p>
        </section>

        <section>
          <h4>If you are the Traitor</h4>
          <p>
            Blend in. Look busy. When you catch a tasker alone, tap their name
            on your list to take them out, then wait out your cooldown before the
            next one. <strong>Traitors win once they equal the taskers left.</strong>
          </p>
        </section>

        <section>
          <h4>Meetings</h4>
          <p>
            Anyone still alive can call an emergency meeting. Everyone stops,
            gathers, and argues. Then you all vote, or skip. Most votes is out —
            a tie means nobody goes. The game tells you whether you got it right.
          </p>
        </section>

        <section>
          <h4>Getting caught out</h4>
          <p>
            Once you are out, keep your screen to yourself and stop talking.
            Taskers who are out can still finish their tasks. Traitors who are
            out can sabotage: pick a tasker, hide somewhere, and their tasks
            stay frozen until they find you.
          </p>
        </section>

        <section>
          <h4>House rules worth agreeing first</h4>
          <p>
            Which rooms are in play, whether upstairs counts, and how long you
            get. The app does not enforce any of that — decide it out loud before
            the host starts.
          </p>
        </section>
      </div>
    </details>
  );
}

export default HowToPlay;
