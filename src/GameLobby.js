import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db, realtimeDb, ref, onDisconnect, set, remove } from './firebase';  // Import Realtime Database functions
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, onSnapshot, deleteDoc } from "firebase/firestore";  // Firestore functions

function GameLobby() {
  const { gameCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const playerName = location.state?.playerName || '';  // Get player name from location state
  const maxPlayers = 15;

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    const playerRef = ref(realtimeDb, `games/${gameCode}/players/${playerName}`);
    
    if (playerName) {
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          updateDoc(gameRef, {
            players: arrayUnion(playerName)
          });
        } else {
          setDoc(gameRef, {
            players: [playerName],
            creator: playerName  // Mark the creator of the game
          });
        }

        setIsCreator(location.state.isCreator || false);
        setLoading(false);
      });

      set(playerRef, { connected: true });

      onDisconnect(playerRef).remove().then(() => {
        updateDoc(gameRef, {
          players: arrayRemove(playerName)
        });
      });
    }
  }, [gameCode, playerName, location.state]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = doc.data();
        setPlayers(gameData.players || []);
      }
    });

    return () => unsubscribe();
  }, [gameCode]);

  // Assign roles and navigate to countdown screen
  const startGame = async () => {
    if (players.length > 0) {
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const imposter = shuffledPlayers[0];
      const crewmates = shuffledPlayers.slice(1);

      const roles = {};
      roles[imposter] = 'Imposter';
      crewmates.forEach((crewmate) => {
        roles[crewmate] = 'Crewmate';
      });

      const gameRef = doc(db, "games", gameCode);
      await updateDoc(gameRef, { roles });

      // Pass the isCreator flag to the countdown screen
      navigate(`/countdown/${gameCode}`, { state: { playerName, isCreator } });
    }
  };

  const finishGame = async () => {
    const gameRef = doc(db, "games", gameCode);

    try {
      await deleteDoc(gameRef);  // Delete the game document from Firestore
      alert("Game ended and data deleted.");
      navigate("/");  // Navigate back to home
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  if (loading) {
    return <div>Loading game data...</div>;
  }

  return (
    <div className="game-lobby">
      <h2>Game Lobby</h2>
      <p>Game Code: <strong>{gameCode}</strong></p>
      <div>
        <h3>Players ({players.length}/{maxPlayers}):</h3>
        <ul>
          {players.map((player, index) => (
            <li key={index}>{player}</li>
          ))}
        </ul>
      </div>

      {isCreator && (
        <div>
          <button onClick={startGame} disabled={players.length === 0}>
            Start Game
          </button>
          <button onClick={finishGame} disabled={players.length === 0}>
            Finish Game and Delete Data
          </button>
        </div>
      )}
    </div>
  );
}

export default GameLobby;
