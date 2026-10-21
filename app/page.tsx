import { Suspense } from "react";
import Search from "./search";

export default function Home() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}
