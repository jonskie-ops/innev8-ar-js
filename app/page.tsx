import { App } from "@/components/App";
import { Splash } from "@/components/Splash";

export default function Home() {
  return (
    <Splash>
      <main>
        <App />
      </main>
    </Splash>
  );
}
