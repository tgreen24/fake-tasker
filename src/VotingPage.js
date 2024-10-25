import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';  // Firestore config

function DeadPlayersList({ deadPlayers }) {
  if (deadPlayers.length === 0) return
  return (
    <div className="dead-players-list">
      <h3>Dead Players</h3>
      <p className="dead-player">{deadPlayers.join(', ')}</p>
    </div>
  );
}

function VotingPage() {
  const { gameCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const playerName = location.state?.playerName || '';
  const [players, setPlayers] = useState([]);
  const [votes, setVotes] = useState({});
  const [selectedVote, setSelectedVote] = useState('');
  const [voteConfirmation, setVoteConfirmation] = useState('');
  const [voteSubmitted, setVoteSubmitted] = useState(false); 
  const [votingResult, setVotingResult] = useState('');  // State to store the voting result
  const [votingEnded, setVotingEnded] = useState(false);
  const [meetingCaller, setMeetingCaller] = useState('');
  const [displayedResult, setDisplayedResult] = useState(''); 
  const [deadPlayers, setDeadPlayers] = useState([]);

  useEffect(() => {
    if (votingResult) {
      setDisplayedResult(''); // Reset the displayed result
  
      for (let i = 0; i < votingResult.length; i++) {
        setTimeout(() => {
          setDisplayedResult((prev) => prev + votingResult[i]);
        }, i * 100); // Adjust the timing as needed (100 ms per character)
      }
    }
  }, [votingResult]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
  
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
  
        // If the gameEnded flag is true, navigate all players to the game over screen
        if (gameData.winner) {
          const result = gameData.winner === 'Crewmates' 
            ? 'Crewmates Win!' 
            : 'Imposters Win!';
          
            setTimeout(() => {
              navigate(`/gameover/${gameCode}`, { state: { playerName, result } });
            }, 5000);
        }
      }
    });
  
    return () => unsubscribe();  // Clean up listener on component unmount
  }, [gameCode, navigate, playerName]);

  // Load players for voting
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    getDoc(gameRef).then((docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        setPlayers(gameData.players || []);  // Load the list of players for voting
        setMeetingCaller(gameData.meetingCaller); 
        setDeadPlayers(gameData.killList || []);
      }
    });
  }, [gameCode]);

  // Listen for real-time updates of votes from Firestore
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        const currentVotes = gameData.votes || {};
        setVotes(currentVotes); // Update the local votes state

        const alivePlayers = players.filter((player) => !deadPlayers.includes(player));

        // Count the number of players who have voted
        const aliveVotesCast = Object.keys(currentVotes).filter((voter) => alivePlayers.includes(voter)).length;

        // If all players have voted, end the voting process
        if (aliveVotesCast > 0 && aliveVotesCast === alivePlayers.length) {
          handleVoteEnd(currentVotes);  // Call handleVoteEnd to process the votes
        }
      }
    });

    return () => unsubscribe();
  }, [gameCode, players.length, voteSubmitted]);

  const handleVoteEnd = async (votes) => {
    const gameRef = doc(db, "games", gameCode);
    const gameData = (await getDoc(gameRef)).data();
  
    votes = votes || gameData.votes || {};  // Retrieve votes if not passed
    const voteCounts = {};
  
    // Count the votes
    Object.values(votes).forEach((vote) => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    // Find the player with the majority of votes, or "skip"
    const highestVoteCount = Math.max(...Object.values(voteCounts));
    const candidatesWithHighestVotes = Object.keys(voteCounts).filter(
        (candidate) => voteCounts[candidate] === highestVoteCount
    );

    let resultMessage = '';
  
    // If there's a tie or no majority, no one is voted out
    if (candidatesWithHighestVotes.length > 1 || highestVoteCount === 1) {
        resultMessage = "No one was voted out due to a tie.";
    } else if (candidatesWithHighestVotes[0] === 'skip') {
        // If "skip" has the majority, handle skip vote
        resultMessage = "The vote was skipped.";
    } else {
        // Handle the voted-out player
        const votedOutPlayer = candidatesWithHighestVotes[0];
        const isImposter = gameData.roles[votedOutPlayer] === 'Imposter';

        if (isImposter) {
            resultMessage = `${votedOutPlayer} was an Imposter and was voted out!`;
        } else {
            resultMessage = `${votedOutPlayer} was not an Imposter and was voted out.`;
        }
        await updateDoc(gameRef, {
          killList: arrayUnion(votedOutPlayer)  // Mark the player as dead
        });
    }
    setVotingResult(resultMessage);
    setVotingEnded(true);

    // Reset the meetingCalled flag and store voting result
    await updateDoc(gameRef, { meetingCalled: false, votingResult: resultMessage });

    // Check if all imposters are gone or only one crewmate is left
    const remainingImposters = Object.keys(gameData.roles).filter(
      (player) => gameData.roles[player] === 'Imposter' && !gameData.killList.includes(player)
    ).length;

    const remainingCrewmates = Object.keys(gameData.roles).filter(
      (player) => gameData.roles[player] === 'Crewmate' && !gameData.killList.includes(player)
    ).length;

    if (remainingImposters === 0) {
        // Log for debugging
        console.log('All imposters are voted out. Crewmates win!');
        
        // Set the gameEnded flag and the winner
        await updateDoc(gameRef, { gameEnded: true, winner: 'Crewmates' });
        
    } else if (remainingCrewmates <= 1) {
        // Log for debugging
        console.log('Less than 1 crewmate alive. Imposters win!');
        
        // Set the gameEnded flag and the winner
        await updateDoc(gameRef, { gameEnded: true, winner: 'Imposters' });
    } else {
        // Log the state for further debugging
        console.log('Game continues. Imposters remaining:', remainingImposters, 'Crewmates remaining:', remainingCrewmates);
    }
};



const submitVote = () => {
    if (!selectedVote) {
      alert('Please select a player to vote or skip!');
      return;
    }

    const gameRef = doc(db, "games", gameCode);
    updateDoc(gameRef, {
      [`votes.${playerName}`]: selectedVote  // Store each player's vote
    });

    // Update the confirmation message based on the player's choice
    if (selectedVote === 'skip') {
      setVoteConfirmation("You skipped voting.");
    } else {
      setVoteConfirmation(`You voted for: ${selectedVote}`);
    }

    setVoteSubmitted(true);
};


  // Ensure voting result is displayed to all players and everyone navigates back to the game
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();

        // Show voting result for 5 seconds, then navigate back to the game
        if (!gameData.meetingCalled && votingEnded) {
          setTimeout(() => {
            updateDoc(gameRef, { meetingCalled: false, votingResult: {}, votes: {} });
            navigate(`/countdown/${gameCode}`, { state: { playerName } });
          }, 5000);
        }
      }
    });

    return () => unsubscribe();
  }, [gameCode, navigate, playerName, votingEnded]);

  const isAlive = !deadPlayers.includes(playerName);

  return (
    <div className="voting-page">
    <div className="voting-card-container">
      <h2>Emergency Meeting called by {meetingCaller}</h2>
      {!votingEnded ? (
        !voteSubmitted && (
          <>
            <div className="voting-grid">
              {players
              .filter((player) => !deadPlayers.includes(player))
              .map((player, index) => (
                <div 
                  key={index} 
                  className={`voting-card ${selectedVote === player ? 'selected' : ''}`}
                  onClick={() => setSelectedVote(player)}
                >
                  <span>{player}</span>
                </div>
              ))}
            </div>
            <div 
              className={`voting-card ${selectedVote === 'skip' ? 'selected' : ''}`}
              onClick={() => setSelectedVote('skip')}
            >
              <span>Skip Vote</span>
            </div>
            {isAlive && ( // Show submit button only if player is alive
              <button className="submit-vote-button" onClick={submitVote}>Submit Vote</button>
            )}
            <DeadPlayersList deadPlayers={deadPlayers} />
          </>
        )
      ) : (
        <div className="voting-result">
          <h3>{displayedResult}</h3>
        </div>
      )}
      {voteConfirmation && <p>{voteConfirmation}</p>}
    </div>
  </div>
  );
}

export default VotingPage;
