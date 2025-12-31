// import { generateClient } from "aws-amplify/data";

// 追加
import { useAuthenticator } from '@aws-amplify/ui-react';

function App() {
  // 追加
  const { signOut } = useAuthenticator();

  return (
    <main>
      <button onClick={signOut}>Sign out</button>
    </main>
  );
}

export default App;
