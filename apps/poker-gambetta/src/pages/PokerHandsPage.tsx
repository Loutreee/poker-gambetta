import handsImage from "../assets/classement-poker01.png";

export default function PokerHandsPage() {
  return (
    <div className="grid grid-2">
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ marginTop: 0 }}>Les mains au poker</h2>
        <p style={{ marginTop: 4, color: "#444" }}>
          Un rappel rapide des combinaisons possibles au Texas Hold’em, de la plus forte
          à la plus faible. Utilise cette page comme mémo pendant les parties.
        </p>
      </div>

      <div className="card card-no-scroll-x" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
        <img
          src={handsImage}
          alt="Classement des mains de poker"
          style={{
            maxWidth: "100%",
            height: "auto",
            display: "inline-block",
          }}
        />
      </div>
    </div>
  );
}

