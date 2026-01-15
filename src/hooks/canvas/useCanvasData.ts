import { useState, useRef, useCallback, useEffect } from 'react';
import type { AppNode, Connection, Group, NodeStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CanvasDataState {
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
}

interface UseCanvasDataReturn {
  // State
  data: CanvasDataState;
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];

  // Refs (for event handlers to avoid stale closures)
  dataRef: React.RefObject<CanvasDataState>;
  nodesRef: React.RefObject<AppNode[]>;
  connectionsRef: React.RefObject<Connection[]>;
  groupsRef: React.RefObject<Group[]>;

  // Direct setters
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setData: React.Dispatch<React.SetStateAction<CanvasDataState>>;

  // Node operations
  addNode: (node: AppNode) => void;
  addNodes: (nodes: AppNode[]) => void;
  updateNode: (id: string, updates: Partial<AppNode>) => void;
  updateNodeData: (id: string, dataUpdates: Partial<AppNode['data']>, sizeUpdates?: { width?: number; height?: number }, title?: string) => void;
  updateNodeStatus: (id: string, status: NodeStatus, error?: string) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  getNode: (id: string) => AppNode | undefined;

  // Connection operations
  addConnection: (connection: Connection) => boolean;
  deleteConnection: (from: string, to: string) => void;
  deleteConnectionsForNode: (nodeId: string) => void;
  getConnectionsForNode: (nodeId: string) => Connection[];

  // Group operations
  addGroup: (group: Group) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  getGroup: (id: string) => Group | undefined;

  // Batch operations
  loadData: (data: CanvasDataState) => void;
  clearAll: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useCanvasData(
  initialData: CanvasDataState = { nodes: [], connections: [], groups: [] }
): UseCanvasDataReturn {
  // State
  const [nodes, setNodes] = useState<AppNode[]>(initialData.nodes);
  const [connections, setConnections] = useState<Connection[]>(initialData.connections);
  const [groups, setGroups] = useState<Group[]>(initialData.groups);

  // Refs for event handlers
  const nodesRef = useRef<AppNode[]>(nodes);
  const connectionsRef = useRef<Connection[]>(connections);
  const groupsRef = useRef<Group[]>(groups);
  const dataRef = useRef<CanvasDataState>({ nodes, connections, groups });

  // Sync refs
  useEffect(() => {
    nodesRef.current = nodes;
    dataRef.current = { ...dataRef.current, nodes };
  }, [nodes]);

  useEffect(() => {
    connectionsRef.current = connections;
    dataRef.current = { ...dataRef.current, connections };
  }, [connections]);

  useEffect(() => {
    groupsRef.current = groups;
    dataRef.current = { ...dataRef.current, groups };
  }, [groups]);

  // Computed data object
  const data: CanvasDataState = { nodes, connections, groups };

  // Direct data setter
  const setData = useCallback((value: React.SetStateAction<CanvasDataState>) => {
    if (typeof value === 'function') {
      const newData = value(dataRef.current);
      setNodes(newData.nodes);
      setConnections(newData.connections);
      setGroups(newData.groups);
    } else {
      setNodes(value.nodes);
      setConnections(value.connections);
      setGroups(value.groups);
    }
  }, []);

  // ============================================================================
  // Node Operations
  // ============================================================================

  const addNode = useCallback((node: AppNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const addNodes = useCallback((newNodes: AppNode[]) => {
    setNodes(prev => [...prev, ...newNodes]);
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<AppNode>) => {
    setNodes(prev => prev.map(node =>
      node.id === id ? { ...node, ...updates } : node
    ));
  }, []);

  const updateNodeData = useCallback((
    id: string,
    dataUpdates: Partial<AppNode['data']>,
    sizeUpdates?: { width?: number; height?: number },
    title?: string
  ) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== id) return node;
      return {
        ...node,
        data: { ...node.data, ...dataUpdates },
        ...(sizeUpdates?.width !== undefined && { width: sizeUpdates.width }),
        ...(sizeUpdates?.height !== undefined && { height: sizeUpdates.height }),
        ...(title !== undefined && { title }),
      };
    }));
  }, []);

  const updateNodeStatus = useCallback((id: string, status: NodeStatus, error?: string) => {
    setNodes(prev => prev.map(node =>
      node.id === id
        ? { ...node, status, data: { ...node.data, error: error || undefined } }
        : node
    ));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(node => node.id !== id));
    // Also remove connections
    setConnections(prev => prev.filter(conn => conn.from !== id && conn.to !== id));
    // Remove from group nodeIds
    setGroups(prev => prev.map(group => ({
      ...group,
      nodeIds: group.nodeIds?.filter(nid => nid !== id)
    })));
  }, []);

  const deleteNodes = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setNodes(prev => prev.filter(node => !idSet.has(node.id)));
    setConnections(prev => prev.filter(conn => !idSet.has(conn.from) && !idSet.has(conn.to)));
    setGroups(prev => prev.map(group => ({
      ...group,
      nodeIds: group.nodeIds?.filter(nid => !idSet.has(nid))
    })));
  }, []);

  const getNode = useCallback((id: string) => {
    return nodesRef.current.find(node => node.id === id);
  }, []);

  // ============================================================================
  // Connection Operations
  // ============================================================================

  const addConnection = useCallback((connection: Connection): boolean => {
    // Check if connection already exists
    const exists = connectionsRef.current.some(
      c => c.from === connection.from && c.to === connection.to
    );
    if (exists) return false;

    // Prevent self-connections
    if (connection.from === connection.to) return false;

    setConnections(prev => [...prev, connection]);

    // Update target node's inputs array
    setNodes(prev => prev.map(node =>
      node.id === connection.to && !node.inputs.includes(connection.from)
        ? { ...node, inputs: [...node.inputs, connection.from] }
        : node
    ));

    return true;
  }, []);

  const deleteConnection = useCallback((from: string, to: string) => {
    setConnections(prev => prev.filter(conn => !(conn.from === from && conn.to === to)));

    // Update target node's inputs array
    setNodes(prev => prev.map(node =>
      node.id === to
        ? { ...node, inputs: node.inputs.filter(id => id !== from) }
        : node
    ));
  }, []);

  const deleteConnectionsForNode = useCallback((nodeId: string) => {
    // Get all connections involving this node
    const affectedConnections = connectionsRef.current.filter(
      conn => conn.from === nodeId || conn.to === nodeId
    );

    // Remove connections
    setConnections(prev => prev.filter(conn => conn.from !== nodeId && conn.to !== nodeId));

    // Update inputs arrays for affected nodes
    setNodes(prev => prev.map(node => {
      // If this node was receiving input from deleted node
      if (node.inputs.includes(nodeId)) {
        return { ...node, inputs: node.inputs.filter(id => id !== nodeId) };
      }
      // If the deleted node was receiving input from this node
      const outgoingToDeleted = affectedConnections.some(
        conn => conn.from === node.id && conn.to === nodeId
      );
      return node;
    }));
  }, []);

  const getConnectionsForNode = useCallback((nodeId: string) => {
    return connectionsRef.current.filter(
      conn => conn.from === nodeId || conn.to === nodeId
    );
  }, []);

  // ============================================================================
  // Group Operations
  // ============================================================================

  const addGroup = useCallback((group: Group) => {
    setGroups(prev => [...prev, group]);
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(group =>
      group.id === id ? { ...group, ...updates } : group
    ));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(group => group.id !== id));
  }, []);

  const getGroup = useCallback((id: string) => {
    return groupsRef.current.find(group => group.id === id);
  }, []);

  // ============================================================================
  // Batch Operations
  // ============================================================================

  const loadData = useCallback((newData: CanvasDataState) => {
    setNodes(newData.nodes);
    setConnections(newData.connections);
    setGroups(newData.groups);
  }, []);

  const clearAll = useCallback(() => {
    setNodes([]);
    setConnections([]);
    setGroups([]);
  }, []);

  return {
    // State
    data,
    nodes,
    connections,
    groups,

    // Refs
    dataRef,
    nodesRef,
    connectionsRef,
    groupsRef,

    // Direct setters
    setNodes,
    setConnections,
    setGroups,
    setData,

    // Node operations
    addNode,
    addNodes,
    updateNode,
    updateNodeData,
    updateNodeStatus,
    deleteNode,
    deleteNodes,
    getNode,

    // Connection operations
    addConnection,
    deleteConnection,
    deleteConnectionsForNode,
    getConnectionsForNode,

    // Group operations
    addGroup,
    updateGroup,
    deleteGroup,
    getGroup,

    // Batch operations
    loadData,
    clearAll,
  };
}
