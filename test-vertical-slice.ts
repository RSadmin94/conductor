// Test script for vertical slice: Idea → Feasibility → Decision → Planning → Execution
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './src/router';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      fetch: async (url, options) => {
        console.log('Requesting:', url, options?.method);
        const response = await fetch(url, options);
        if (!response.ok) {
          const text = await response.text();
          console.error('HTTP error:', response.status, text);
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return response;
      },
    }),
  ],
});

async function testVerticalSlice() {
  try {
    console.log('=== Testing Conductor MVP Vertical Slice ===\n');
    
    // Step 1: Create project
    console.log('1. Creating project...');
    try {
      const result = await client['project.create'].mutate({
        userId: '00000000-0000-0000-0000-000000000001',
      });
      const projectId = result.projectId;
      console.log(`   ✓ Project created: ${projectId}\n`);
    
    // Step 2: Submit idea
    console.log('2. Submitting idea...');
    const { ideaId } = await client['idea.intake'].mutate({
      projectId,
      content: 'Build a simple web application with user authentication',
    });
    console.log(`   ✓ Idea submitted: ${ideaId}\n`);
    
    // Step 3: Trigger feasibility
    console.log('3. Triggering feasibility analysis...');
    const { jobId: feasibilityJobId } = await client['feasibility.trigger'].mutate({
      projectId,
    });
    console.log(`   ✓ Feasibility job enqueued: ${feasibilityJobId}`);
    console.log('   (Waiting for worker to process...)\n');
    
    // Wait a bit for worker to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Record decision (Approved)
    console.log('4. Recording decision (Approved)...');
    const { decisionId } = await client['decision.record'].mutate({
      projectId,
      outcome: 'Approved',
      rationale: 'The idea is feasible and aligns with our goals',
    });
    console.log(`   ✓ Decision recorded: ${decisionId}\n`);
    
    // Step 5: Trigger planning
    console.log('5. Triggering planning...');
    const { jobId: planningJobId } = await client['planning.trigger'].mutate({
      projectId,
    });
    console.log(`   ✓ Planning job enqueued: ${planningJobId}`);
    console.log('   (Waiting for worker to process...)\n');
    
    // Wait for planning to complete
    console.log('   (Waiting for planning worker to complete...)\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 6: Start execution
    console.log('6. Starting execution...');
    const { runId, executionArtifactUri } = await client['execution.start'].mutate({
      projectId,
    });
    console.log(`   ✓ Execution started: ${runId}`);
    console.log(`   ✓ Execution artifact URI: ${executionArtifactUri}`);
    console.log('   (Waiting for worker to prepare handoff...)\n');
    
    // Wait for execution prepare
    console.log('   (Waiting for execution worker to prepare handoff...)\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 7: Get tasks and report completion
    console.log('7. Querying tasks and reporting completions...');
    const { tasks } = await client['tasks.list'].query({
      runId,
    });
    console.log(`   Found ${tasks.length} tasks\n`);
    
    // Report each task as completed
    for (const task of tasks) {
      console.log(`   Reporting task ${task.id.substring(0, 8)}... as completed`);
      await client['execution.report'].mutate({
        runId,
        taskId: task.id,
        status: 'completed',
        artifacts: [{
          name: `result_${task.id.substring(0, 8)}`,
          uri: `artifact://${runId}/${task.id}`,
        }],
      });
    }
    console.log('   ✓ All tasks reported as completed\n');
    
    // Wait for review to trigger
    console.log('8. Waiting for review to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check final project state
    const { project } = await client['project.get'].query({
      projectId,
    });
    console.log(`   ✓ Final project state: ${project.current_state}\n`);
    
      console.log('✓ Vertical slice test completed successfully!');
      console.log(`\nProject ${projectId} completed flow: Idea → Feasibility → Approved → Planning → Execution → Review → ${project.current_state}`);
    } catch (innerError: any) {
      console.error('   Inner error:', innerError);
      throw innerError;
    }
    
  } catch (error: any) {
    console.error('✗ Test failed:', error.message);
    console.error('  Full error:', error);
    if (error.data) {
      console.error('  Error data:', error.data);
    }
    if (error.cause) {
      console.error('  Error cause:', error.cause);
    }
    process.exit(1);
  }
}

testVerticalSlice();

