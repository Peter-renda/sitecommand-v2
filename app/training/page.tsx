import { redirect } from "next/navigation";

export default function TrainingPage() {
  // The Training section opens on its first tree node: Practice.
  redirect("/training/practice");
}
