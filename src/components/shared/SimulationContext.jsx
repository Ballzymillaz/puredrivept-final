import React, { createContext, useContext, useState } from 'react';

const SimulationContext = createContext(null);

export function SimulationProvider({ children }) {
  const [simulation, setSimulation] = useState(null);
  // simulation = { role: 'driver'|'fleet_manager', targetId: string, targetName: string } | null

  return (
    <SimulationContext.Provider value={{ simulation, setSimulation }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  return useContext(SimulationContext);
}