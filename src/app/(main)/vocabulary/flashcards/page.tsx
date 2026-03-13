import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function FlashcardsPage() {
  return (
    <Card>
      <CardHeader>
        <Badge>Phase 4</Badge>
        <CardTitle className="font-serif text-3xl">
          Flashcard queue scaffold
        </CardTitle>
        <CardDescription>
          This is where the SM-2 daily review session will live after vocabulary
          saving is stable.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Phase 4 will wire due-card queries, answer reveal, and Again / Hard /
        Good / Easy rating updates.
      </CardContent>
    </Card>
  );
}
