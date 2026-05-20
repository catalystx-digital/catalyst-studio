'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  GitMerge, 
  Check, 
  X,
  FileWarning,
  ArrowRight,
  ArrowLeft,
  Zap
} from 'lucide-react';

interface SyncConflict {
  id: string;
  contentTypeId: string;
  baseVersion: string;
  sourceChanges: any;
  targetChanges: any;
  conflictType: 'field_type_mismatch' | 'field_deletion' | 'schema_incompatible' | 'validation_failure';
  severity: 'high' | 'medium' | 'low';
  resolutionStrategy?: 'manual' | 'auto-merge' | 'prefer-source' | 'prefer-target';
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: any;
}

export function ConflictResolutionPanel() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  const [resolutionStrategy, setResolutionStrategy] = useState<string>('manual');
  const [manualResolution, setManualResolution] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sync/conflicts?status=unresolved');
      if (response.ok) {
        const data = await response.json();
        setConflicts(data.conflicts);
        if (data.conflicts.length > 0 && !selectedConflict) {
          setSelectedConflict(data.conflicts[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async () => {
    if (!selectedConflict) return;
    
    try {
      setResolving(true);
      const response = await fetch(`/api/sync/conflicts?id=${selectedConflict.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionStrategy,
          resolution: resolutionStrategy === 'manual' ? manualResolution : undefined,
          resolvedBy: 'current-user'
        })
      });
      
      if (response.ok) {
        await fetchConflicts();
        setSelectedConflict(null);
        setManualResolution('');
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case 'field_type_mismatch':
        return 'Field Type Mismatch';
      case 'field_deletion':
        return 'Field Deletion';
      case 'schema_incompatible':
        return 'Schema Incompatible';
      case 'validation_failure':
        return 'Validation Failure';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-muted-foreground">Loading conflicts...</div>
        </CardContent>
      </Card>
    );
  }

  if (conflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            <CardTitle>No Conflicts</CardTitle>
          </div>
          <CardDescription>
            All synchronization conflicts have been resolved
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="col-span-1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <CardTitle>Conflicts</CardTitle>
          </div>
          <CardDescription>
            {conflicts.length} unresolved conflict{conflicts.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <button
                key={conflict.id}
                onClick={() => setSelectedConflict(conflict)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedConflict?.id === conflict.id 
                    ? 'bg-muted border-primary' 
                    : 'hover:bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {conflict.contentTypeId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getConflictTypeLabel(conflict.conflictType)}
                    </p>
                  </div>
                  <Badge variant={getSeverityBadgeVariant(conflict.severity) as any}>
                    {conflict.severity}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Conflict Resolution</CardTitle>
          <CardDescription>
            Review and resolve synchronization conflicts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedConflict ? (
            <div className="space-y-4">
              <Alert>
                <FileWarning className="h-4 w-4" />
                <AlertDescription>
                  <strong>Conflict Type:</strong> {getConflictTypeLabel(selectedConflict.conflictType)}
                  <br />
                  <strong>Content Type:</strong> {selectedConflict.contentTypeId}
                  <br />
                  <strong>Base Version:</strong> {selectedConflict.baseVersion}
                </AlertDescription>
              </Alert>

              <Tabs defaultValue="diff" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="diff">Three-Way Diff</TabsTrigger>
                  <TabsTrigger value="source">Source Changes</TabsTrigger>
                  <TabsTrigger value="target">Target Changes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="diff" className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <Card>
                      <CardHeader className="py-2">
                        <CardTitle className="text-sm">Base Version</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-2 rounded">
                          {JSON.stringify(selectedConflict.baseVersion, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="py-2">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <ArrowLeft className="h-3 w-3" />
                          Source Changes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-2 rounded">
                          {JSON.stringify(selectedConflict.sourceChanges || {}, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="py-2">
                        <CardTitle className="text-sm flex items-center gap-1">
                          Target Changes
                          <ArrowRight className="h-3 w-3" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-2 rounded">
                          {JSON.stringify(selectedConflict.targetChanges || {}, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="source">
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="text-sm bg-muted p-4 rounded">
                        {JSON.stringify(selectedConflict.sourceChanges || {}, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="target">
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="text-sm bg-muted p-4 rounded">
                        {JSON.stringify(selectedConflict.targetChanges || {}, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="space-y-4">
                <div>
                  <Label>Resolution Strategy</Label>
                  <RadioGroup 
                    value={resolutionStrategy} 
                    onValueChange={setResolutionStrategy}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual">Manual Resolution</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto-merge" id="auto-merge" />
                      <Label htmlFor="auto-merge">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Auto-merge (AI-powered)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="prefer-source" id="prefer-source" />
                      <Label htmlFor="prefer-source">Prefer Source Changes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="prefer-target" id="prefer-target" />
                      <Label htmlFor="prefer-target">Prefer Target Changes</Label>
                    </div>
                  </RadioGroup>
                </div>

                {resolutionStrategy === 'manual' && (
                  <div>
                    <Label htmlFor="manual-resolution">Manual Resolution (JSON)</Label>
                    <Textarea
                      id="manual-resolution"
                      value={manualResolution}
                      onChange={(e) => setManualResolution(e.target.value)}
                      placeholder="Enter the resolved content as JSON..."
                      className="mt-2 font-mono text-sm"
                      rows={8}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedConflict(null);
                      setManualResolution('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResolveConflict}
                    disabled={resolving || (resolutionStrategy === 'manual' && !manualResolution)}
                  >
                    <GitMerge className="h-4 w-4 mr-2" />
                    {resolving ? 'Resolving...' : 'Resolve Conflict'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Select a conflict to resolve</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}