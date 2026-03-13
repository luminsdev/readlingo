import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VocabularyPage() {
  return (
    <Card>
      <CardHeader>
        <Badge>Phase 3</Badge>
        <CardTitle className="font-serif text-3xl">
          Vocabulary manager scaffold
        </CardTitle>
        <CardDescription>
          Saved words, source sentences, and book filters will appear here once
          the AI explanation slice is live.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        The route is ready so navigation and information architecture stay
        stable as later phases land.
      </CardContent>
    </Card>
  );
}
